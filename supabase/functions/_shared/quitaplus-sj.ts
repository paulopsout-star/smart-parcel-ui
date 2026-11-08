/**
 * Quita+ — modalidade SEM JUROS (credencial, lojista e credor próprios).
 *
 * Usado SOMENTE pelas funções `quitaplus-sj-*`. As funções do fluxo atual (quitaplus-token,
 * quitaplus-prepayment, quitaplus-link-boleto, quitaplus-prepayment-status, quitaplus-simulation)
 * não importam este módulo e não foram alteradas: o isolamento é por função.
 *
 * Fato comprovado em 07/11/2026 (bancada quitaplus-semjuros-test): a tabela sem juros na
 * autorização só vale com a COMBINAÇÃO credencial nova + MerchantId + CreditorDocument do
 * CNPJ sem juros. Qualquer outra combinação cobra com juros. Por isso este módulo força os três.
 *
 * Secrets:
 *   QUITAPLUS_SEMJUROS_CLIENT_ID / QUITAPLUS_SEMJUROS_CLIENT_SECRET  (obrigatórios)
 *   QUITAPLUS_SEMJUROS_MERCHANT_ID        (opcional; padrão SJ_MERCHANT_DEFAULT)
 *   QUITAPLUS_SEMJUROS_CREDITOR_NAME      (opcional; padrão QUITA_MAIS_CREDITOR_NAME)
 *   QUITAPLUS_BASE_URL                    (mesmo gateway do fluxo atual)
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export const SJ_MERCHANT_DEFAULT = "54329414000502";
export const SJ_PARCELA_MINIMA_CENTS = 2000;
export const SJ_MAX_PARCELAS = 12;
const UPSTREAM_TIMEOUT_MS = 20_000;
const USER_AGENT = "AutonegocieHub/quitaplus-sj";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

export interface SjCtx {
  clientId: string;
  clientSecret: string;
  merchantId: string;
  creditorDocument: string;
  creditorName: string;
  baseUrl: string;
}

/** Contexto fixo da modalidade. Nada vem do cliente. */
export function sjCtx(): SjCtx | { error: string } {
  const clientId = Deno.env.get("QUITAPLUS_SEMJUROS_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("QUITAPLUS_SEMJUROS_CLIENT_SECRET") || "";
  if (!clientId || !clientSecret) return { error: "Secrets QUITAPLUS_SEMJUROS_CLIENT_ID/_SECRET ausentes" };
  if (clientId === (Deno.env.get("QUITAPLUS_CLIENT_ID") || "")) {
    return { error: "QUITAPLUS_SEMJUROS_CLIENT_ID é igual à credencial atual: a modalidade sem juros exige a credencial nova" };
  }
  const merchantId = digits(Deno.env.get("QUITAPLUS_SEMJUROS_MERCHANT_ID")) || SJ_MERCHANT_DEFAULT;
  if (merchantId === digits(Deno.env.get("QUITA_MAIS_MERCHANT_ID"))) {
    return { error: "Lojista sem juros igual ao lojista do fluxo atual" };
  }
  return {
    clientId,
    clientSecret,
    merchantId,
    creditorDocument: merchantId, // combinação comprovada: credor = lojista sem juros
    creditorName: Deno.env.get("QUITAPLUS_SEMJUROS_CREDITOR_NAME") || Deno.env.get("QUITA_MAIS_CREDITOR_NAME") || "",
    baseUrl: (Deno.env.get("QUITAPLUS_BASE_URL") || "https://pay-gt.autonegocie.com").replace(/\/$/, ""),
  };
}

// Cache de token por isolate
let tokenCache: { value: string; expiresAt: number; clientId: string } | null = null;

export async function sjToken(ctx: SjCtx): Promise<string> {
  if (tokenCache && tokenCache.clientId === ctx.clientId && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.value;
  }
  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${ctx.baseUrl}/connect/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": USER_AGENT },
        body: JSON.stringify({ clientId: ctx.clientId, clientSecret: ctx.clientSecret, grant_type: "client_credentials" }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      const text = await res.text();
      if (res.ok) {
        const data = JSON.parse(text);
        const token = data?.access_token ?? data?.accessToken ?? null;
        if (!token) throw new Error("Resposta do token sem access_token");
        const expiresIn = Number(data?.expires_in ?? 3600);
        tokenCache = { value: String(token), expiresAt: Date.now() + expiresIn * 1000, clientId: ctx.clientId };
        return tokenCache.value;
      }
      lastErr = `HTTP ${res.status}`;
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) {
      lastErr = String((e as Error)?.message ?? e);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  throw new Error(`Falha ao obter token Quita+ (sem juros): ${lastErr}`);
}

export function quitaHeaders(token: string, withBody = true): Record<string, string> {
  const h: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json",
    "User-Agent": USER_AGENT,
  };
  if (withBody) h["Content-Type"] = "application/json";
  return h;
}

/** Interruptor geral (app_settings.sem_juros_ativo). */
export async function semJurosAtivo(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "sem_juros_ativo").maybeSingle();
  return data?.value === true || data?.value === "true";
}

export interface SjCharge {
  id: string;
  company_id: string;
  modalidade: string;
  status: string;
  payment_method: string;
  amount: number;
  card_amount: number | null;
  pix_amount: number | null;
  installments: number | null;
  metadata: Record<string, unknown> | null;
  payer_name: string | null;
  payer_document: string | null;
  payer_email: string | null;
  payer_phone: string | null;
  boleto_linha_digitavel: string | null;
  pre_payment_key: string | null;
  creditor_document: string | null;
  creditor_name: string | null;
}

const SJ_CHARGE_COLUMNS =
  "id, company_id, modalidade, status, payment_method, amount, card_amount, pix_amount, installments, metadata, " +
  "payer_name, payer_document, payer_email, payer_phone, boleto_linha_digitavel, pre_payment_key, creditor_document, creditor_name";

/**
 * Carrega a cobrança pelo id, pelo id do payment_link ou pela prePaymentKey, e EXIGE modalidade sem_juros.
 * Cobrança com juros nunca entra nas funções sj: devolve erro e o front usa o fluxo atual.
 */
export async function loadSjCharge(
  supabase: SupabaseClient,
  by: { chargeId?: string | null; paymentLinkId?: string | null; prePaymentKey?: string | null },
): Promise<{ charge: SjCharge; paymentLinkId: string | null } | { error: string; code: string }> {
  let chargeId = by.chargeId || null;
  let paymentLinkId = by.paymentLinkId || null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!chargeId && paymentLinkId && uuid.test(paymentLinkId)) {
    // No fluxo só-cartão (/payment-direct/:id) o "paymentLinkId" pode ser o id da própria cobrança
    const { data: link } = await supabase.from("payment_links").select("id, charge_id").eq("id", paymentLinkId).maybeSingle();
    if (link?.charge_id) chargeId = link.charge_id;
    else chargeId = paymentLinkId;
  }

  let q = supabase.from("charges").select(SJ_CHARGE_COLUMNS);
  if (chargeId && uuid.test(chargeId)) q = q.eq("id", chargeId);
  else if (by.prePaymentKey) q = q.eq("pre_payment_key", by.prePaymentKey);
  else return { error: "Cobrança não identificada", code: "charge_not_found" };

  const { data, error } = await q.maybeSingle();
  const charge = data as unknown as SjCharge | null;
  if (error || !charge) return { error: "Cobrança não encontrada", code: "charge_not_found" };
  if (charge.modalidade !== "sem_juros") {
    return { error: "Esta cobrança não é da modalidade sem juros", code: "not_sem_juros" };
  }
  return { charge, paymentLinkId };
}

/** Valor do cartão (centavos): normalizado pelo gatilho em metadata.sem_juros.cartao_cents. */
export function sjCardAmount(charge: SjCharge): number {
  const sj = (charge.metadata?.sem_juros ?? {}) as Record<string, unknown>;
  const fromMeta = Number(sj.cartao_cents);
  if (Number.isFinite(fromMeta) && fromMeta > 0) return Math.round(fromMeta);
  if (charge.payment_method === "cartao_pix") return Math.round(Number(charge.card_amount || 0));
  return Math.round(Number(charge.amount || 0));
}

/** Máximo de parcelas da faixa (normalizado pelo gatilho); nunca acima de SJ_MAX_PARCELAS. */
export function sjMaxInstallments(charge: SjCharge): number {
  const sj = (charge.metadata?.sem_juros ?? {}) as Record<string, unknown>;
  const n = Math.round(Number(sj.parcelas_maximas));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, SJ_MAX_PARCELAS) : 1;
}

export interface Condition {
  installments: number;
  installmentAmount: number;
  totalAmount: number;
  paymentMethod?: string;
  [k: string]: unknown;
}

/**
 * Mantém só as condições permitidas pela faixa e pela parcela mínima, e confere que NENHUMA
 * tem acréscimo. Se o Quita+ devolver juros para este lojista, a modalidade está indisponível.
 */
export function filtrarCondicoes(raw: unknown, cartaoCents: number, maxParcelas: number): { conditions: Condition[]; semAcrescimo: boolean } {
  const list: Condition[] = Array.isArray(raw) ? (raw as Condition[]) : [];
  const conditions = list
    .map((c) => ({ ...c, installments: Number(c.installments), installmentAmount: Number(c.installmentAmount), totalAmount: Number(c.totalAmount) }))
    .filter((c) => c.installments >= 1 && c.installments <= maxParcelas)
    .filter((c) => c.installments === 1 || c.installmentAmount >= SJ_PARCELA_MINIMA_CENTS)
    .sort((a, b) => a.installments - b.installments);
  const semAcrescimo = conditions.length > 0 && conditions.every((c) => c.totalAmount === cartaoCents);
  return { conditions, semAcrescimo };
}

/** Simulação no Quita+ para o lojista sem juros. */
export async function sjSimulate(ctx: SjCtx, token: string, amountInCents: number): Promise<{ ok: true; conditions: unknown; raw: unknown } | { ok: false; status: number; body: string }> {
  const res = await fetch(`${ctx.baseUrl}/payment/simulation`, {
    method: "POST",
    headers: quitaHeaders(token),
    body: JSON.stringify({ amountInCents, merchantId: ctx.merchantId }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 500) };
  const raw = JSON.parse(text);
  return { ok: true, conditions: raw?.conditions ?? raw?.simulation?.conditions ?? [], raw };
}

/** Mapeamento statusCode → status interno (igual a quitaplus-prepayment-status). */
export const sjStatusCodeMap: Record<number, string> = {
  1: "pre_authorized",
  2: "cancelled",
  3: "boleto_linked",
  4: "validating",
  5: "payment_denied",
  6: "approved",
  7: "awaiting_validation",
  8: "validating",
  9: "completed",
  50: "cnpj_nao_cadastrado",
};

/** Mensagem amigável a partir da resposta do Quita+ (mesma tabela do fluxo atual). */
export function extractUserFriendlyMessage(apiResponse: string, httpStatus: number): string {
  const friendly: Record<string, string> = {
    CARD_DECLINED: "Cartão recusado pela operadora",
    INSUFFICIENT_FUNDS: "Saldo insuficiente no cartão",
    EXPIRED_CARD: "Cartão expirado",
    INVALID_CVV: "Código de segurança (CVV) inválido",
    INVALID_CARD_NUMBER: "Número do cartão inválido",
    ANTIFRAUD_DECLINED: "Transação não aprovada pelo sistema antifraude",
    CARD_BLOCKED: "Cartão bloqueado",
    PROCESSING_ERROR: "Erro ao processar pagamento. Tente novamente.",
    INVALID_EXPIRATION_DATE: "Data de validade do cartão inválida",
    TRANSACTION_NOT_ALLOWED: "Transação não permitida para este cartão",
    CARD_NOT_SUPPORTED: "Bandeira do cartão não suportada",
    LIMIT_EXCEEDED: "Limite do cartão excedido",
    DUPLICATE_TRANSACTION: "Transação duplicada detectada",
    INVALID_AMOUNT: "Valor da transação inválido",
    TIMEOUT: "Tempo limite excedido. Tente novamente.",
  };
  try {
    const p = JSON.parse(apiResponse);
    const msg = p.message || p.Message || p.errorMessage || p.error?.message || p.returnMessage || p.ReturnMessage;
    const code = p.code || p.Code || p.errorCode || p.returnCode || p.ReturnCode || p.error?.code;
    if (code && friendly[String(code).toUpperCase()]) return friendly[String(code).toUpperCase()];
    if (typeof msg === "string" && msg.trim()) return msg;
    if (p.authorized === false || p.Authorized === false) return "Cartão não autorizado pela operadora";
  } catch {
    if (apiResponse.includes("Access Denied") || apiResponse.includes("errors.edgesuite.net")) {
      return "Serviço temporariamente indisponível. Tente novamente em alguns minutos.";
    }
  }
  if (httpStatus === 400) return "Dados do cartão inválidos. Verifique e tente novamente.";
  if (httpStatus === 401) return "Falha na autenticação. Tente novamente.";
  if (httpStatus === 403) return "Transação não autorizada.";
  if (httpStatus === 422) return "Dados do pagamento inválidos. Verifique e tente novamente.";
  if (httpStatus >= 500) return "Erro temporário no servidor. Tente novamente em instantes.";
  return "Não foi possível processar o pagamento. Verifique os dados e tente novamente.";
}

/** Vincula a linha digitável à pré-autorização com a credencial sem juros. */
export async function sjAttachBankslip(ctx: SjCtx, token: string, prePaymentKey: string, linhaDigitavel: string) {
  const barcode = digits(linhaDigitavel);
  const url = `${ctx.baseUrl}/prepayment/AttachBankslip/${encodeURIComponent(prePaymentKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: quitaHeaders(token),
    body: JSON.stringify({ Barcode: barcode }),
    signal: AbortSignal.timeout(45_000),
  });
  const text = await res.text();
  const lower = text.toLowerCase();
  const bodyError = ["não encontrado", "not found", "invalid", "canceled", "cancelled", "expired", "expirado", "cancelado", "error", "erro", "failed", "falha"]
    .some((s) => lower.includes(s));
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text); } catch { /* texto */ }
  return { ok: res.ok && !bodyError, status: res.status, text, data, url };
}

/** Guarda em metadata.quitaplus_sj o que foi usado na autorização (rastreabilidade). */
export async function registrarUsoSj(supabase: SupabaseClient, chargeId: string, ctx: SjCtx, extra: Record<string, unknown>) {
  const { data } = await supabase.from("charges").select("metadata").eq("id", chargeId).maybeSingle();
  const meta = (data?.metadata as Record<string, unknown>) || {};
  await supabase.from("charges").update({
    metadata: {
      ...meta,
      quitaplus_sj: {
        credencial: "sem_juros",
        merchant_id: ctx.merchantId,
        creditor_document: ctx.creditorDocument,
        ...extra,
      },
    },
  }).eq("id", chargeId);
}
