// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, digits, json, loadSjCharge, sjAttachBankslip, sjCtx, sjToken } from "../_shared/quitaplus-sj.ts";

/**
 * quitaplus-sj-link-boleto — vincula a linha digitável a uma pré-autorização SEM JUROS,
 * com a credencial sem juros. Mesmo contrato e mesma resposta de quitaplus-link-boleto (intacto):
 *   { prePaymentKey, paymentLinkId, boleto: { number } }  →  { success, apiRawResponse, apiMetadata }
 * Só atende prePaymentKey de cobrança com modalidade = 'sem_juros'.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const requestData = await req.json().catch(() => ({}));
    const prePaymentKey = String(requestData?.prePaymentKey || "");
    const linha = digits(requestData?.boleto?.number);
    const paymentLinkId = String(requestData?.paymentLinkId || "");

    if (!/^[0-9a-fA-F-]{20,64}$/.test(prePaymentKey)) {
      return json({ success: false, apiRawResponse: JSON.stringify({ error: "prePaymentKey inválida" }), apiMetadata: { httpStatus: 400, requestUrl: "validation" } }, 200);
    }
    if (![47, 48].includes(linha.length)) {
      return json({
        success: false,
        apiRawResponse: JSON.stringify({ error: "Linha digitável do boleto inválida", message: "A linha digitável deve ter 47 ou 48 dígitos" }),
        apiMetadata: { httpStatus: 400, httpStatusText: "Bad Request", httpHeaders: {}, requestUrl: "validation" },
      }, 200);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const loaded = await loadSjCharge(supabase, { prePaymentKey });
    if ("error" in loaded) return json({ success: false, error: loaded.error, code: loaded.code }, 200);
    const { charge } = loaded;

    const ctx = sjCtx();
    if ("error" in ctx) return json({ success: false, error: "Modalidade sem juros indisponível", code: "sem_juros_config" }, 200);

    console.log("[quitaplus-sj-link-boleto]", { chargeId: charge.id, prePaymentKey, boletoLastDigits: linha.slice(-4) });

    const token = await sjToken(ctx);
    const r = await sjAttachBankslip(ctx, token, prePaymentKey, linha);
    const apiMetadata = { httpStatus: r.status, requestUrl: r.url };

    if (!r.ok) {
      console.warn("[quitaplus-sj-link-boleto] vínculo não aceito:", r.status, r.text.slice(0, 300));
      return json({ success: false, apiRawResponse: r.text, apiMetadata, errorDetected: true, errorMessage: "Vínculo do boleto não aceito pelo Quita+" }, 200);
    }

    // Mesmo efeito no banco do fluxo atual
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuid.test(paymentLinkId)) {
      const { error } = await supabase
        .from("payment_splits")
        .update({ link_id: r.data?.linkId ?? r.data?.link_id ?? null, status: "linked" })
        .eq("payment_link_id", paymentLinkId)
        .eq("pre_payment_key", prePaymentKey);
      if (error) console.error("[quitaplus-sj-link-boleto] payment_splits:", error);
    }
    await supabase.from("charges")
      .update({ status: "boleto_linked", boleto_linked_at: new Date().toISOString() })
      .eq("id", charge.id)
      .in("status", ["pre_authorized", "pending", "analyzing"]);

    return json({ success: true, modalidade: "sem_juros", apiRawResponse: r.text, apiMetadata });
  } catch (e) {
    console.error("[quitaplus-sj-link-boleto] erro:", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido", code: 500, message: "Erro interno do servidor" }, 200);
  }
});
