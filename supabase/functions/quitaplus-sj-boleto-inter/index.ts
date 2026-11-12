// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { cancelarCobranca, emitirCobranca, enderecoPadrao, interConfig, recuperarCobranca, vencimentoPadrao, waitUntilIssued } from "../_shared/inter.ts";
import type { InterCobranca, InterPagador } from "../_shared/inter.ts";
import { corsHeaders, json, loadSjCharge, quitaHeaders, sjAttachBankslip, sjCardAmount, sjCtx, sjToken } from "../_shared/quitaplus-sj.ts";

/**
 * quitaplus-sj-boleto-inter — emite no Inter o boleto com o VALOR DO CARTÃO e vincula à
 * pré-autorização SEM JUROS com a credencial sem juros.
 *
 * Espelha inter-boleto-issue (fluxo atual, intacto) com três diferenças:
 *   - só atende cobrança com modalidade = 'sem_juros', em QUALQUER tipo com cartão ('cartao' ou 'cartao_pix').
 *     Na modalidade sem juros o boleto do credor (valor à vista) nunca é vinculado ao Quita+: o valor do cartão
 *     é maior que ele (inclui o desconto retido). O Quita+ paga o boleto do Inter, igual ao cartão.
 *   - status e vínculo no Quita+ usam a credencial sem juros;
 *   - grava os mesmos campos (metadata.inter_cobranca, boleto_admin_linha_digitavel, charge_executions),
 *     então inter-webhook e o histórico funcionam sem mudança.
 *
 * Entrada: { chargeId, source?: 'sj-prepayment' | 'manual' }. Autorização: service role (chamada interna)
 * ou admin logado (botão do histórico).
 */

const fail = (error: string, message: string, extra: Record<string, unknown> = {}) => json({ success: false, error, message, ...extra }, 200);

async function actorFrom(req: Request, supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!bearer) return null;
  if (bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return "service";
  const { data: { user } } = await supabase.auth.getUser(bearer);
  if (!user) return null;
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  return role?.role === "admin" ? user.id : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const actor = await actorFrom(req, supabase);
  if (!actor) return json({ success: false, error: "Não autorizado" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const source = String(body?.source || "manual");

    const loaded = await loadSjCharge(supabase, { chargeId: body?.chargeId });
    if ("error" in loaded) return fail(loaded.code, loaded.error);
    const { charge } = loaded;

    if (!["cartao", "cartao_pix"].includes(charge.payment_method)) return fail("Tipo de pagamento inválido", "A cobrança não tem cartão");
    if (!charge.pre_payment_key) return fail("Cartão não autorizado", "O cartão precisa estar pré-autorizado");

    const ctx = sjCtx();
    if ("error" in ctx) return fail("sem_juros_config", ctx.error);

    let cfg: ReturnType<typeof interConfig>;
    try { cfg = interConfig(); } catch (e) { return fail("inter_nao_configurado", String(e)); }

    const { data: cardSplit } = await supabase
      .from("payment_splits")
      .select("id, status, amount_cents, pre_payment_key")
      .eq("charge_id", charge.id).eq("method", "credit_card").neq("status", "cancelled")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    // Valor do boleto = valor do cartão (igual à pré-autorização). Sem split (fluxo só-cartão sem link), usa a cobrança.
    const amountCents: number = Number(cardSplit?.amount_cents) || sjCardAmount(charge);
    if (!amountCents || amountCents < 250) return fail("Valor inválido", "O Inter exige valor mínimo de R$ 2,50");

    const meta = (charge.metadata && typeof charge.metadata === "object") ? charge.metadata as Record<string, unknown> : {};
    const existing = meta.inter_cobranca as Record<string, unknown> | undefined;
    if (existing && existing.pre_payment_key === charge.pre_payment_key && existing.linhaDigitavel && existing.linked_at) {
      return fail("ja_emitido", "Já existe boleto do Inter vinculado a este pré-pagamento", { inter_cobranca: existing });
    }

    // RETOMADA: emissão anterior ainda sem vínculo (o Inter leva minutos para emitir). Nunca emitir outro boleto
    // enquanto o anterior estiver vivo.
    let resume: { codigoSolicitacao: string; issued: InterCobranca } | null = null;
    if (existing && existing.pre_payment_key === charge.pre_payment_key && existing.codigoSolicitacao && !existing.linked_at && !existing.cancelled_after_link_error) {
      const codigoPrev = String(existing.codigoSolicitacao);
      let cob: InterCobranca | null = null;
      try { cob = await recuperarCobranca(cfg, codigoPrev); } catch (e) { console.warn("[quitaplus-sj-boleto-inter] retomada: consulta falhou", String(e)); }
      const situacaoPrev = cob?.cobranca?.situacao ?? null;
      const linhaPrev = cob?.boleto?.linhaDigitavel?.replace(/\D/g, "") || null;
      if (cob && situacaoPrev !== "CANCELADO" && situacaoPrev !== "EXPIRADO") {
        if (!linhaPrev) {
          return fail("inter_em_processamento", "O Inter ainda está emitindo o boleto desta cobrança. Aguarde alguns minutos e clique de novo: o mesmo boleto será vinculado, sem emitir outro.", { codigoSolicitacao: codigoPrev, situacao: situacaoPrev });
        }
        resume = { codigoSolicitacao: codigoPrev, issued: cob };
      }
    }

    // Pré-autorização precisa estar Received (1) — consulta com a credencial sem juros
    const token = await sjToken(ctx);
    const st = await fetch(`${ctx.baseUrl}/prepayment/status/${encodeURIComponent(charge.pre_payment_key)}`, {
      headers: quitaHeaders(token, false), signal: AbortSignal.timeout(20_000),
    });
    const stText = await st.text();
    let statusCode: number | null = null;
    try { statusCode = Number(JSON.parse(stText)?.statusCode ?? JSON.parse(stText)?.StatusCode) || null; } catch { /* texto */ }
    if (statusCode !== 1) return fail("Pré-pagamento inválido", `O pré-pagamento não está em Received (código ${statusCode ?? "desconhecido"})`);

    // Pagador
    const doc = String(charge.payer_document || "").replace(/\D/g, "");
    if (doc.length !== 11 && doc.length !== 14) return fail("Pagador inválido", "CPF/CNPJ do pagador inválido");
    const endereco = enderecoPadrao();
    if (!endereco) return fail("inter_nao_configurado", "Secret INTER_PAGADOR_ENDERECO ausente");
    const phone = String(charge.payer_phone || "").replace(/\D/g, "");
    const pagador: InterPagador = {
      cpfCnpj: doc,
      tipoPessoa: doc.length === 14 ? "JURIDICA" : "FISICA",
      nome: String(charge.payer_name || "").trim().slice(0, 100),
      ...endereco,
      ...(charge.payer_email ? { email: String(charge.payer_email).trim().slice(0, 50) } : {}),
      ...(phone.length >= 10 ? { ddd: phone.slice(0, 2), telefone: phone.slice(2, 11) } : {}),
    };

    const { data: company } = await supabase.from("companies").select("name").eq("id", charge.company_id).maybeSingle();
    const companyName = String(company?.name || "").trim();
    const seuNumero = companyName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 15)
      || charge.id.replace(/-/g, "").slice(0, 15);
    const dataVencimento = vencimentoPadrao();

    let codigoSolicitacao: string;
    if (resume) {
      codigoSolicitacao = resume.codigoSolicitacao;
    } else {
      console.log("[quitaplus-sj-boleto-inter] emitindo", { chargeId: charge.id, valorNominal: amountCents / 100, dataVencimento, env: cfg.env });
      codigoSolicitacao = await emitirCobranca(cfg, {
        seuNumero,
        valorNominal: Math.round(amountCents) / 100,
        dataVencimento,
        numDiasAgenda: 0,
        pagador,
        mensagem: { linha1: (companyName ? `${companyName} - ` : "") + `cobranca ${charge.id.slice(0, 8)}`, linha2: "Pagamento do cartao sem juros" },
      });
      // Guardar o código ANTES de esperar: se a emissão demorar, a próxima chamada retoma este boleto
      await supabase.from("charges").update({
        metadata: {
          ...meta,
          inter_cobranca: {
            codigoSolicitacao, seuNumero, valorCents: amountCents, dataVencimento, situacao: "EM_PROCESSAMENTO", env: cfg.env,
            issued_at: new Date().toISOString(), issued_by: actor, source, modalidade: "sem_juros", pre_payment_key: charge.pre_payment_key,
            linhaDigitavel: null, linked_at: null, link_error: null,
          },
          inter_cobrancas_history: existing ? [...(Array.isArray(meta.inter_cobrancas_history) ? meta.inter_cobrancas_history : []), existing] : (meta.inter_cobrancas_history ?? []),
        },
      }).eq("id", charge.id);
    }

    let issued: InterCobranca;
    try {
      issued = resume ? resume.issued : await waitUntilIssued(cfg, codigoSolicitacao, 20_000);
    } catch (e) {
      console.warn("[quitaplus-sj-boleto-inter] emissão ainda em processamento após a espera", { codigoSolicitacao, erro: String(e) });
      return fail("inter_em_processamento", "O boleto foi registrado no Inter, mas a emissão ainda está em processamento. Aguarde alguns minutos e clique de novo: o mesmo boleto será vinculado, sem emitir outro.", { codigoSolicitacao });
    }
    const linha = issued.boleto?.linhaDigitavel?.replace(/\D/g, "");
    if (!linha) return fail("inter_sem_linha", `Cobrança ${codigoSolicitacao} sem linha digitável (situação ${issued.cobranca?.situacao})`, { codigoSolicitacao });

    const interInfo = {
      codigoSolicitacao, seuNumero,
      nossoNumero: issued.boleto?.nossoNumero ?? null,
      linhaDigitavel: linha,
      codigoBarras: issued.boleto?.codigoBarras ?? null,
      pixCopiaECola: issued.pix?.pixCopiaECola ?? null,
      valorCents: amountCents, dataVencimento,
      situacao: issued.cobranca?.situacao ?? null,
      env: cfg.env,
      issued_at: new Date().toISOString(), issued_by: actor, source,
      modalidade: "sem_juros",
      pre_payment_key: charge.pre_payment_key,
      linked_at: null as string | null,
      link_error: null as string | null,
    };
    const history = Array.isArray(meta.inter_cobrancas_history) ? meta.inter_cobrancas_history : [];
    const metaWithIssue = { ...meta, inter_cobranca: interInfo, inter_cobrancas_history: existing ? [...history, existing] : history };
    await supabase.from("charges").update({ metadata: metaWithIssue }).eq("id", charge.id);

    // Vincular com a credencial sem juros
    const r = await sjAttachBankslip(ctx, token, charge.pre_payment_key, linha);
    if (!r.ok) {
      const msg = `HTTP ${r.status}: ${r.text.slice(0, 200)}`;
      console.error("[quitaplus-sj-boleto-inter] vínculo falhou; cancelando boleto no Inter", msg);
      let cancelled = false;
      try { await cancelarCobranca(cfg, codigoSolicitacao, "Falha ao vincular no Quita+"); cancelled = true; } catch (e) { console.error("[quitaplus-sj-boleto-inter] cancelamento falhou", e); }
      await supabase.from("charges").update({ metadata: { ...metaWithIssue, inter_cobranca: { ...interInfo, link_error: msg, cancelled_after_link_error: cancelled } } }).eq("id", charge.id);
      return fail("vinculo_falhou", `Boleto emitido no Inter mas o vínculo no Quita+ falhou: ${msg}`, { codigoSolicitacao, cancelledAtInter: cancelled });
    }

    const previousLinha: string | null = (charge as any).boleto_admin_linha_digitavel || null;
    const linksHistory = Array.isArray(meta.boleto_links_history) ? meta.boleto_links_history : [];
    const linkedAt = new Date().toISOString();
    await supabase.from("charges").update({
      boleto_admin_linha_digitavel: linha,
      status: "boleto_linked",
      boleto_linked_at: linkedAt,
      metadata: {
        ...metaWithIssue,
        inter_cobranca: { ...interInfo, linked_at: linkedAt },
        ...(previousLinha ? { boleto_links_history: [...linksHistory, { linha: previousLinha, replaced_at: linkedAt, replaced_by: linha, pre_payment_key: charge.pre_payment_key, replaced_by_user: actor, via: "inter-sj" }] } : {}),
      },
    }).eq("id", charge.id);
    if (cardSplit) {
      await supabase.from("payment_splits").update({ link_id: r.data?.linkId ?? r.data?.link_id ?? null, status: "linked" }).eq("id", cardSplit.id);
    }
    await supabase.from("charge_executions").insert({
      charge_id: charge.id,
      company_id: charge.company_id,
      status: "boleto_linked",
      execution_log: { source: "quitaplus-sj-boleto-inter", codigoSolicitacao, linhaDigitavel: linha, valorCents: amountCents, dataVencimento, actor, trigger: source, credencial: "sem_juros" },
    });

    return json({ success: true, modalidade: "sem_juros", codigoSolicitacao, linhaDigitavel: linha, valorCents: amountCents, dataVencimento, linkedAt });
  } catch (e) {
    console.error("[quitaplus-sj-boleto-inter] erro:", e);
    return fail("erro_interno", e instanceof Error ? e.message : String(e));
  }
});
