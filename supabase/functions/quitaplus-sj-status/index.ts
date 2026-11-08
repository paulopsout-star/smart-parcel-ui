// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, json, loadSjCharge, quitaHeaders, sjCtx, sjStatusCodeMap, sjToken } from "../_shared/quitaplus-sj.ts";

/**
 * quitaplus-sj-status — status de uma pré-autorização SEM JUROS, com a credencial sem juros.
 * Mesma resposta de quitaplus-prepayment-status (fluxo atual, intacto).
 * Só atende prePaymentKey de cobrança com modalidade = 'sem_juros'.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prePaymentKey } = await req.json().catch(() => ({}));
    if (!prePaymentKey || !/^[0-9a-fA-F-]{20,64}$/.test(String(prePaymentKey))) {
      return json({ success: false, error: "prePaymentKey é obrigatório" }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const loaded = await loadSjCharge(supabase, { prePaymentKey });
    if ("error" in loaded) return json({ success: false, error: loaded.error, code: loaded.code }, 200);

    const ctx = sjCtx();
    if ("error" in ctx) return json({ success: false, error: "Modalidade sem juros indisponível", code: "sem_juros_config" }, 200);

    const token = await sjToken(ctx);
    const response = await fetch(`${ctx.baseUrl}/prepayment/status/${encodeURIComponent(prePaymentKey)}`, {
      method: "GET",
      headers: quitaHeaders(token, false),
      signal: AbortSignal.timeout(20_000),
    });
    const responseText = await response.text();
    console.log("[quitaplus-sj-status]", { prePaymentKey, status: response.status, body: responseText.slice(0, 300) });

    if (!response.ok) {
      return json({ success: false, error: "Erro ao consultar status", apiRawResponse: responseText, httpStatus: response.status }, 200);
    }

    let data: Record<string, unknown>;
    try { data = JSON.parse(responseText); } catch {
      return json({ success: false, error: "Resposta inválida da API", apiRawResponse: responseText }, 200);
    }

    const statusCode = Number(data.statusCode ?? data.StatusCode) || null;
    const statusName = data.statusDescription ?? data.status ?? data.Status ?? null;
    const transactionId = data.transactionId ?? data.TransactionId ?? null;
    const authorizationCode = data.authorizationCode ?? data.AuthorizationCode ?? null;
    const internalStatus = statusCode ? sjStatusCodeMap[statusCode] || "pending" : null;

    return json({
      success: true,
      modalidade: "sem_juros",
      prePaymentKey,
      statusCode,
      statusName,
      internalStatus,
      transactionId,
      authorizationCode,
      apiRawResponse: responseText,
    });
  } catch (e) {
    console.error("[quitaplus-sj-status] erro:", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }, 200);
  }
});
