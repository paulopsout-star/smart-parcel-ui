// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { cancelarCobranca, emitirCobranca, enderecoPadrao, interConfig, recuperarCobranca, vencimentoPadrao } from "../_shared/inter.ts";

/**
 * quitaplus-semjuros-test — bancada de TESTES DE INTEGRAÇÃO da credencial "sem juros" do Quita+.
 *
 * Função isolada: não é chamada por nenhum fluxo de produção e não altera dados (só lê a API).
 * Existe para validar a nova credencial ANTES de mexer no processo de pagamento.
 *
 * Credenciais ("credential"):
 *   "padrao"    — QUITAPLUS_CLIENT_ID / _SECRET (fluxo atual, com juros)
 *   "sem_juros" — QUITAPLUS_SEMJUROS_CLIENT_ID / _SECRET (+ QUITAPLUS_SEMJUROS_MERCHANT_ID opcional)
 *   "informada" — enviada na própria chamada em `override` (homologação). Não é gravada nem logada.
 *
 * `override`: { clientId, clientSecret, merchantId?, baseUrl? } — baseUrl só aceita os hosts de ALLOWED_BASES.
 * Com "padrao" e "sem_juros", `override.merchantId` troca apenas o lojista enviado na chamada.
 *
 * Autorização: admin (JWT do usuário) OU header `x-test-key` cujo SHA-256 confere com TEST_KEY_SHA256.
 * O token OAuth NUNCA é devolvido nem logado.
 *
 * Ações (POST JSON):
 *   { "action": "status" }                                              — quais secrets existem
 *   { "action": "token", "credential": "..." }                           — obtém token (ok, tempo, validade)
 *   { "action": "simulate", "credential": "...", "amounts": [100000] }   — simulação por valor (centavos)
 *   { "action": "compare", "amounts": [100000] }                         — padrao x (informada | sem_juros)
 *   { "action": "prepayment_status", "credential": "...", "prePaymentKey": "uuid" }
 *
 * Fase 2 — pagamento real de teste (valor limitado a PAY_MAX_CENTS, sem tocar em charges/payment_splits):
 *   { "action": "pay_authorize", "credential", "override": { "merchantId" }, "amountInCents", "installments",
 *     "payer": { name, document, email, phoneNumber }, "card": { holderName, number, expirationDate, cvv } }
 *       — SOMENTE admin logado (o cartão é digitado pelo admin na página de teste); tentativa única, sem retry.
 *   { "action": "pay_issue_boleto", "amountInCents", "payer": { name, document, email?, phoneNumber? } } — boleto Inter
 *   { "action": "pay_boleto_status", "codigoSolicitacao" } · { "action": "pay_cancel_boleto", "codigoSolicitacao" }
 *   { "action": "pay_attach", "credential", "prePaymentKey", "linhaDigitavel" } — vincula o boleto à pré-autorização
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-test-key",
};

// SHA-256 da chave de teste (a chave em si fica fora do repositório)
const TEST_KEY_SHA256 = "b0b2c8f4e79760fdce656e5fdb9cf0654fe40830b6241dd0e541415ff5584c0e";

const UPSTREAM_TIMEOUT_MS = 20_000;
const USER_AGENT = "AutonegocieHub/quitaplus-semjuros-test";
const ALLOWED_BASES = ["https://pay-gt.autonegocie.com", "https://api-sandbox.cappta.com.br"];

// Fase 2: teto do pagamento de teste e lojistas aceitos
const PAY_MAX_CENTS = 5000;
const SEM_JUROS_MERCHANT = "54329414000502";
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

type Credential = "padrao" | "sem_juros" | "informada";

interface Ctx {
  label: Credential;
  clientId: string;
  clientSecret: string;
  merchantId: string;
  baseUrl: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authorize(req: Request): Promise<string | null> {
  const testKey = req.headers.get("x-test-key");
  if (testKey && (await sha256Hex(testKey)) === TEST_KEY_SHA256) return "test-key";

  const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!bearer) return null;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user } } = await supabase.auth.getUser(bearer);
  if (!user) return null;
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  return role?.role === "admin" ? user.id : null;
}

function defaultBaseUrl(): string {
  return (Deno.env.get("QUITAPLUS_BASE_URL") || "https://pay-gt.autonegocie.com").replace(/\/$/, "");
}

function ctxFor(credential: Credential, override: any): Ctx | { error: string } {
  const defaultMerchant = Deno.env.get("QUITA_MAIS_MERCHANT_ID") || "";
  if (credential === "informada") {
    const base = String(override?.baseUrl || defaultBaseUrl()).replace(/\/$/, "");
    if (!ALLOWED_BASES.includes(base)) return { error: `baseUrl não permitida (use: ${ALLOWED_BASES.join(", ")})` };
    if (!override?.clientId || !override?.clientSecret) return { error: "override.clientId e override.clientSecret são obrigatórios" };
    return {
      label: "informada",
      clientId: String(override.clientId),
      clientSecret: String(override.clientSecret),
      merchantId: String(override.merchantId || defaultMerchant),
      baseUrl: base,
    };
  }
  if (credential === "sem_juros") {
    return {
      label: "sem_juros",
      clientId: Deno.env.get("QUITAPLUS_SEMJUROS_CLIENT_ID") || "",
      clientSecret: Deno.env.get("QUITAPLUS_SEMJUROS_CLIENT_SECRET") || "",
      merchantId: String(override?.merchantId || Deno.env.get("QUITAPLUS_SEMJUROS_MERCHANT_ID") || defaultMerchant),
      baseUrl: defaultBaseUrl(),
    };
  }
  return {
    label: "padrao",
    clientId: Deno.env.get("QUITAPLUS_CLIENT_ID") || "",
    clientSecret: Deno.env.get("QUITAPLUS_CLIENT_SECRET") || "",
    merchantId: String(override?.merchantId || defaultMerchant), // permite testar outro lojista com a credencial atual
    baseUrl: defaultBaseUrl(),
  };
}

const mask = (text: string) => text.replace(/[A-Za-z0-9_\-\.]{40,}/g, "<redigido>").slice(0, 400);

/** Decodifica só o payload do JWT (declarações públicas: cliente, lojista, escopos). Nunca devolve o token. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
    delete payload.jti;
    return payload;
  } catch {
    return null;
  }
}

// Cache em memória por credencial+host (só durante a vida do isolate)
const tokenCache = new Map<string, { value: string; expiresAt: number }>();

async function getToken(ctx: Ctx, forceNew = false) {
  const started = Date.now();
  const cacheKey = `${ctx.baseUrl}|${ctx.clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (!forceNew && cached && cached.expiresAt > Date.now() + 60_000) {
    return {
      token: cached.value,
      info: { ok: true, credential: ctx.label, host: ctx.baseUrl, ms: 0, fromCache: true, expiresIn: Math.floor((cached.expiresAt - Date.now()) / 1000) },
    };
  }
  if (!ctx.clientId || !ctx.clientSecret) {
    return { token: null, info: { ok: false, credential: ctx.label, host: ctx.baseUrl, ms: 0, error: "Credenciais ausentes" } };
  }

  try {
    const res = await fetch(`${ctx.baseUrl}/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ clientId: ctx.clientId, clientSecret: ctx.clientSecret, grant_type: "client_credentials" }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      return { token: null, info: { ok: false, credential: ctx.label, host: ctx.baseUrl, httpStatus: res.status, ms, error: mask(text) } };
    }
    const data = JSON.parse(text);
    const token = data?.access_token ?? data?.accessToken ?? data?.token ?? null;
    const expiresIn = Number(data?.expires_in ?? data?.expiresIn ?? 3600);
    if (!token) {
      return { token: null, info: { ok: false, credential: ctx.label, host: ctx.baseUrl, httpStatus: res.status, ms, error: "Resposta sem access_token", campos: Object.keys(data ?? {}) } };
    }
    tokenCache.set(cacheKey, { value: token, expiresAt: Date.now() + expiresIn * 1000 });
    return {
      token,
      info: {
        ok: true, credential: ctx.label, host: ctx.baseUrl, httpStatus: res.status, ms, fromCache: false, expiresIn,
        tokenType: String(data?.token_type ?? data?.tokenType ?? "Bearer"), tokenLength: String(token).length,
        claims: decodeJwtPayload(String(token)),
      },
    };
  } catch (e) {
    return { token: null, info: { ok: false, credential: ctx.label, host: ctx.baseUrl, ms: Date.now() - started, error: String(e?.message ?? e) } };
  }
}

async function simulate(ctx: Ctx, amountInCents: number) {
  const { token, info } = await getToken(ctx);
  if (!token) return { credential: ctx.label, amountInCents, ok: false, stage: "token", token: info };

  const started = Date.now();
  try {
    const res = await fetch(`${ctx.baseUrl}/payment/simulation`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ amountInCents, merchantId: ctx.merchantId }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      return { credential: ctx.label, amountInCents, ok: false, stage: "simulation", httpStatus: res.status, ms, error: mask(text) };
    }
    const raw = JSON.parse(text);
    const conditions = raw?.conditions ?? raw?.simulation?.conditions ?? [];
    // Resumo por condição: acréscimo sobre o valor simulado (0 = sem juros)
    const resumo = (Array.isArray(conditions) ? conditions : []).map((c: any) => {
      const total = Number(c.totalAmount ?? c.total ?? 0);
      const parcela = Number(c.installmentAmount ?? c.installmentValue ?? 0);
      const n = Number(c.installments ?? c.installment ?? 0);
      return {
        parcelas: n,
        valorParcela: parcela,
        total,
        acrescimoCents: total - amountInCents,
        acrescimoPct: amountInCents > 0 ? Number((((total - amountInCents) / amountInCents) * 100).toFixed(2)) : null,
        parcelaVezesN: parcela * n,
      };
    });
    return {
      credential: ctx.label, amountInCents, ok: true, httpStatus: res.status, ms,
      maxParcelas: resumo.reduce((m: number, r: any) => Math.max(m, r.parcelas), 0),
      semJurosEmTodas: resumo.length > 0 && resumo.every((r: any) => r.acrescimoCents === 0),
      resumo,
      camposDaResposta: Object.keys(raw ?? {}),
      camposDaCondicao: conditions?.[0] ? Object.keys(conditions[0]) : [],
      primeiraCondicaoBruta: conditions?.[0] ?? null,
      ultimaCondicaoBruta: conditions?.length ? conditions[conditions.length - 1] : null,
    };
  } catch (e) {
    return { credential: ctx.label, amountInCents, ok: false, stage: "simulation", ms: Date.now() - started, error: String(e?.message ?? e) };
  }
}

async function prepaymentStatus(ctx: Ctx, prePaymentKey: string) {
  if (!/^[0-9a-fA-F-]{20,64}$/.test(prePaymentKey)) return { ok: false, error: "prePaymentKey inválido" };
  const { token, info } = await getToken(ctx);
  if (!token) return { credential: ctx.label, ok: false, stage: "token", token: info };
  const started = Date.now();
  try {
    const res = await fetch(`${ctx.baseUrl}/prepayment/status/${encodeURIComponent(prePaymentKey)}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const text = await res.text();
    let body: unknown = mask(text);
    try { body = JSON.parse(text); } catch { /* mantém texto mascarado */ }
    return { credential: ctx.label, ok: res.ok, httpStatus: res.status, ms: Date.now() - started, body };
  } catch (e) {
    return { credential: ctx.label, ok: false, ms: Date.now() - started, error: String(e?.message ?? e) };
  }
}

/** Remove/mascara qualquer dado de cartão ou valor longo antes de devolver uma resposta da API. */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 30).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = /card|cvv|pan|number|secret|token/i.test(k) && typeof v !== "boolean" ? "<omitido>" : sanitize(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") return value.length > 200 ? value.slice(0, 200) + "…" : value;
  return value;
}

function payAmount(body: any): number | null {
  const amount = Math.round(Number(body?.amountInCents));
  return Number.isFinite(amount) && amount >= 100 && amount <= PAY_MAX_CENTS ? amount : null;
}

/** Pré-autorização real no cartão. Tentativa única: em timeout o estado é desconhecido e NÃO se repete. */
async function payAuthorize(ctx: Ctx, body: any) {
  const amount = payAmount(body);
  if (amount === null) return { ok: false, error: `Valor fora do limite do teste (R$ 1,00 a R$ ${(PAY_MAX_CENTS / 100).toFixed(2)})` };
  const installments = Math.round(Number(body?.installments || 1));
  if (!(installments >= 1 && installments <= 12)) return { ok: false, error: "Parcelas devem estar entre 1 e 12" };
  const allowedMerchants = [Deno.env.get("QUITA_MAIS_MERCHANT_ID") || "", SEM_JUROS_MERCHANT].filter(Boolean);
  if (!allowedMerchants.includes(ctx.merchantId)) return { ok: false, error: "Lojista não permitido neste teste" };

  const payer = body?.payer || {};
  const card = body?.card || {};
  const doc = digits(payer.document);
  const phone = digits(payer.phoneNumber);
  const cardNumber = digits(card.number);
  const cvv = digits(card.cvv);
  const exp = digits(card.expirationDate);
  const problems = [
    !String(payer.name || "").trim() && "nome do pagador",
    ![11, 14].includes(doc.length) && "CPF/CNPJ do pagador",
    !/\S+@\S+\.\S+/.test(String(payer.email || "")) && "e-mail do pagador",
    !(phone.length >= 10 && phone.length <= 11) && "telefone do pagador",
    !String(card.holderName || "").trim() && "nome impresso no cartão",
    !(cardNumber.length >= 13 && cardNumber.length <= 19) && "número do cartão",
    !(cvv.length >= 3 && cvv.length <= 4) && "CVV",
    exp.length !== 4 && "validade (MM/AA)",
  ].filter(Boolean);
  if (problems.length) return { ok: false, error: `Dados inválidos: ${problems.join(", ")}` };

  const { token, info } = await getToken(ctx);
  if (!token) return { ok: false, stage: "token", token: info };

  const payload = {
    MerchantId: ctx.merchantId,
    CreditorName: Deno.env.get("QUITA_MAIS_CREDITOR_NAME") || "",
    CreditorDocument: Deno.env.get("QUITA_MAIS_CREDITOR_DOCUMENT") || "",
    AmountInCents: amount,
    Installments: installments,
    PayerDocument: doc,
    PayerEmail: String(payer.email).trim(),
    PayerPhoneNumber: phone,
    PayerName: String(payer.name).trim(),
    CardHolderName: String(card.holderName).trim(),
    CardNumber: cardNumber,
    CardExpirationDate: `20${exp.slice(2)}/${exp.slice(0, 2)}`,
    CardCvv: cvv,
  };

  const started = Date.now();
  try {
    const res = await fetch(`${ctx.baseUrl}/prepayment/authorize`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000),
    });
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* resposta não-JSON */ }
    return {
      ok: res.ok,
      httpStatus: res.status,
      ms: Date.now() - started,
      merchantId: ctx.merchantId,
      credential: ctx.label,
      amountInCents: amount,
      installments,
      prePaymentKey: data?.prePaymentKey ?? data?.pre_payment_key ?? data?.PrePaymentKey ?? null,
      isApproved: data?.isApproved ?? data?.IsApproved ?? null,
      message: data?.message ?? data?.Message ?? data?.returnMessage ?? data?.ReturnMessage ?? null,
      campos: data ? Object.keys(data) : [],
      corpo: data ? sanitize(data) : mask(text),
    };
  } catch (e) {
    return {
      ok: false, ms: Date.now() - started, merchantId: ctx.merchantId, credential: ctx.label,
      error: String(e?.message ?? e),
      aviso: "Estado desconhecido: NÃO repita a pré-autorização antes de conferir a fatura do cartão.",
    };
  }
}

/** Emite no Inter um boleto de teste no valor informado. Não espera além de ~20 s: devolve o código para consulta. */
async function payIssueBoleto(body: any) {
  const amount = payAmount(body);
  if (amount === null) return { ok: false, error: `Valor fora do limite do teste (R$ 1,00 a R$ ${(PAY_MAX_CENTS / 100).toFixed(2)})` };
  if (amount < 250) return { ok: false, error: "O Inter exige valor mínimo de R$ 2,50" };
  const payer = body?.payer || {};
  const doc = digits(payer.document);
  if (![11, 14].includes(doc.length) || !String(payer.name || "").trim()) return { ok: false, error: "Informe nome e CPF/CNPJ do pagador" };
  const endereco = enderecoPadrao();
  if (!endereco) return { ok: false, error: "Secret INTER_PAGADOR_ENDERECO ausente" };
  const phone = digits(payer.phoneNumber);
  const cfg = interConfig();
  const dataVencimento = vencimentoPadrao();
  const codigoSolicitacao = await emitirCobranca(cfg, {
    seuNumero: "TESTESEMJUROS",
    valorNominal: amount / 100,
    dataVencimento,
    numDiasAgenda: 0,
    pagador: {
      cpfCnpj: doc,
      tipoPessoa: doc.length === 14 ? "JURIDICA" : "FISICA",
      nome: String(payer.name).trim().slice(0, 100),
      ...endereco,
      ...(payer.email ? { email: String(payer.email).trim().slice(0, 50) } : {}),
      ...(phone.length >= 10 ? { ddd: phone.slice(0, 2), telefone: phone.slice(2, 11) } : {}),
    },
    mensagem: { linha1: "Teste de integracao Quita+ sem juros", linha2: "Pagamento de teste" },
  });

  // Emissão é assíncrona no Inter (já levou minutos): consulta por até ~20 s e devolve o que houver
  let last: any = null;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    last = await recuperarCobranca(cfg, codigoSolicitacao);
    if (last?.boleto?.linhaDigitavel && last?.cobranca?.situacao !== "EM_PROCESSAMENTO") break;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return {
    ok: true,
    codigoSolicitacao,
    valorCents: amount,
    dataVencimento,
    situacao: last?.cobranca?.situacao ?? "EM_PROCESSAMENTO",
    linhaDigitavel: digits(last?.boleto?.linhaDigitavel) || null,
    pronto: !!last?.boleto?.linhaDigitavel,
    env: cfg.env,
  };
}

async function payBoletoStatus(codigoSolicitacao: string) {
  if (!/^[0-9a-fA-F-]{20,64}$/.test(codigoSolicitacao)) return { ok: false, error: "codigoSolicitacao inválido" };
  const c: any = await recuperarCobranca(interConfig(), codigoSolicitacao);
  return {
    ok: true,
    codigoSolicitacao,
    situacao: c?.cobranca?.situacao ?? null,
    valorNominal: c?.cobranca?.valorNominal ?? null,
    valorTotalRecebido: c?.cobranca?.valorTotalRecebido ?? null,
    dataSituacao: c?.cobranca?.dataSituacao ?? null,
    linhaDigitavel: digits(c?.boleto?.linhaDigitavel) || null,
    pronto: !!c?.boleto?.linhaDigitavel,
  };
}

/** Vincula a linha digitável à pré-autorização (mesmo endpoint do fluxo atual). */
async function payAttach(ctx: Ctx, prePaymentKey: string, linhaDigitavel: string) {
  if (!/^[0-9a-fA-F-]{20,64}$/.test(prePaymentKey)) return { ok: false, error: "prePaymentKey inválido" };
  const barcode = digits(linhaDigitavel);
  if (![47, 48].includes(barcode.length)) return { ok: false, error: "Linha digitável deve ter 47 ou 48 dígitos" };
  const { token, info } = await getToken(ctx);
  if (!token) return { ok: false, stage: "token", token: info };
  const started = Date.now();
  try {
    const res = await fetch(`${ctx.baseUrl}/prepayment/AttachBankslip/${encodeURIComponent(prePaymentKey)}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ Barcode: barcode }),
      signal: AbortSignal.timeout(45_000),
    });
    const text = await res.text();
    let data: unknown = mask(text);
    try { data = sanitize(JSON.parse(text)); } catch { /* texto */ }
    return { ok: res.ok, httpStatus: res.status, ms: Date.now() - started, credential: ctx.label, corpo: data };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: String(e?.message ?? e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const actor = await authorize(req);
  if (!actor) return json({ error: "Não autorizado" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }
  const action = String(body?.action || "status");
  const credential: Credential = ["padrao", "sem_juros", "informada"].includes(body?.credential) ? body.credential : "sem_juros";
  const amounts: number[] = (Array.isArray(body?.amounts) ? body.amounts : [100000])
    .map((n: unknown) => Math.round(Number(n)))
    .filter((n: number) => Number.isFinite(n) && n > 0)
    .slice(0, 12);

  // Nunca logar `override` (credenciais) nem `card`/`payer` (dados de cartão e pessoais)
  console.log("[quitaplus-semjuros-test]", { action, credential, amounts: amounts.length, actor: actor === "test-key" ? actor : "admin" });

  try {
    if (action === "status") {
      const sj = ctxFor("sem_juros", null) as Ctx;
      const pd = ctxFor("padrao", null) as Ctx;
      return json({
        baseUrl: defaultBaseUrl(),
        hostsPermitidosEmOverride: ALLOWED_BASES,
        padrao: { clientId: !!pd.clientId, clientSecret: !!pd.clientSecret, merchantId: !!pd.merchantId },
        sem_juros: {
          clientId: !!sj.clientId,
          clientSecret: !!sj.clientSecret,
          merchantIdProprio: !!Deno.env.get("QUITAPLUS_SEMJUROS_MERCHANT_ID"),
          merchantIdEfetivo: !!sj.merchantId,
          mesmaCredencialQueAPadrao: !!sj.clientId && sj.clientId === pd.clientId,
        },
      });
    }

    const ctx = ctxFor(credential, body?.override);
    if ("error" in ctx) return json({ error: ctx.error }, 400);

    if (action === "token") {
      const { info } = await getToken(ctx, body?.forceNew === true);
      return json(info);
    }

    if (action === "simulate") {
      const results = [];
      for (const amount of amounts) results.push(await simulate(ctx, amount));
      return json({ credential, host: ctx.baseUrl, results });
    }

    if (action === "compare") {
      // compara a credencial atual com a escolhida (informada ou sem_juros)
      const other = credential === "padrao" ? (ctxFor("sem_juros", null) as Ctx) : ctx;
      const padrao = ctxFor("padrao", null) as Ctx;
      const results = [];
      for (const amount of amounts) {
        const [a, b] = await Promise.all([simulate(padrao, amount), simulate(other, amount)]);
        results.push({ amountInCents: amount, padrao: a, outra: b });
      }
      return json({ outraCredencial: other.label, hostOutra: other.baseUrl, results });
    }

    if (action === "prepayment_status") {
      return json(await prepaymentStatus(ctx, String(body?.prePaymentKey || "")));
    }

    // ---------------- Fase 2: pagamento real de teste ----------------
    if (action === "pay_authorize") {
      // O cartão só pode ser enviado por um admin logado (página de teste), nunca pela chave de teste.
      if (actor === "test-key") return json({ error: "pay_authorize exige um administrador logado" }, 403);
      if (credential === "informada") return json({ error: "Use a credencial atual (padrao) ou a dos secrets (sem_juros)" }, 400);
      return json(await payAuthorize(ctx, body));
    }
    if (action === "pay_issue_boleto") return json(await payIssueBoleto(body));
    if (action === "pay_boleto_status") return json(await payBoletoStatus(String(body?.codigoSolicitacao || "")));
    if (action === "pay_cancel_boleto") {
      const codigo = String(body?.codigoSolicitacao || "");
      if (!/^[0-9a-fA-F-]{20,64}$/.test(codigo)) return json({ ok: false, error: "codigoSolicitacao inválido" }, 400);
      await cancelarCobranca(interConfig(), codigo, "Teste de integracao encerrado");
      return json({ ok: true, codigoSolicitacao: codigo, cancelado: true });
    }
    if (action === "pay_attach") {
      return json(await payAttach(ctx, String(body?.prePaymentKey || ""), String(body?.linhaDigitavel || "")));
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("[quitaplus-semjuros-test] erro", String(e?.message ?? e));
    return json({ error: "erro_interno", message: String(e?.message ?? e) }, 500);
  }
});
