// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";
import {
  applyPixStatus,
  checkPixStatus,
  isAbacatePayId,
  loadAbacatePayConfig,
} from "../_shared/abacatepay.ts";

/**
 * abacatepay-webhook — recebe eventos da AbacatePay (v2), ex.: `transparent.completed`.
 *
 * Cadastrar no painel da AbacatePay (Webhooks) com a URL:
 *   https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/abacatepay-webhook?webhookSecret=<ABACATEPAY_WEBHOOK_SECRET>
 *
 * Segurança: o secret da query é comparado com ABACATEPAY_WEBHOOK_SECRET (se configurado) e,
 * independentemente disso, o status NUNCA é confiado do payload — é sempre reconsultado na API.
 * Um webhook forjado, portanto, não consegue marcar um PIX como pago.
 */

const ABACATE_ID_RE = /^pix_char_[A-Za-z0-9]+$/;

/** Coleta recursivamente todos os IDs pix_char_* presentes no payload (formato do `data` não é documentado). */
function collectPixIds(value: unknown, acc = new Set<string>(), depth = 0): Set<string> {
  if (depth > 6 || value == null) return acc;
  if (typeof value === "string") {
    if (ABACATE_ID_RE.test(value)) acc.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectPixIds(v, acc, depth + 1);
  } else if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectPixIds(v, acc, depth + 1);
  }
  return acc;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method === "GET") {
    return new Response("OK", { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
  }

  try {
    const config = loadAbacatePayConfig();

    const url = new URL(req.url);
    const providedSecret = url.searchParams.get("webhookSecret");
    if (config.webhookSecret) {
      if (providedSecret !== config.webhookSecret) {
        console.warn("[abacatepay-webhook] webhookSecret inválido — requisição rejeitada");
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
    } else {
      console.warn("[abacatepay-webhook] ABACATEPAY_WEBHOOK_SECRET não configurado — aceitando sem validar origem (status é reconsultado na API)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("[abacatepay-webhook] Evento:", payload?.event, "id:", payload?.id, "devMode:", payload?.devMode);

    const pixIds = [...collectPixIds(payload)].filter(isAbacatePayId);
    if (pixIds.length === 0) {
      console.log("[abacatepay-webhook] Nenhum ID pix_char_ no payload, ignorando:", JSON.stringify(payload).substring(0, 500));
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    for (const pixId of pixIds) {
      const { data: splits, error: findError } = await supabase
        .from("payment_splits")
        .select("id, charge_id, status")
        .eq("mp_payment_id", pixId)
        .limit(1);

      if (findError || !splits || splits.length === 0) {
        console.log("[abacatepay-webhook] Nenhum payment_split para", pixId);
        continue;
      }

      const split = splits[0];
      if (split.status === "concluded") {
        console.log("[abacatepay-webhook] Split já concluded, ignorando:", split.id);
        continue;
      }

      // Fonte da verdade: a API, nunca o payload
      const check = await checkPixStatus(config.apiKey, pixId);
      const { internalStatus } = await applyPixStatus(supabase, split, check.status);
      console.log(`[abacatepay-webhook] Split ${split.id}: ${check.status} → ${internalStatus}`);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    // 5xx faz a AbacatePay reenviar; se a falha for nossa (API key, DB) é o que queremos.
    console.error("[abacatepay-webhook] Error:", error);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
