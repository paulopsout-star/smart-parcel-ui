// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";
import {
  applyPixStatus,
  checkPixStatus,
  isAbacatePayId,
  loadAbacatePayConfig,
  mapAbacateStatus,
} from "../_shared/abacatepay.ts";

/**
 * abacatepay-pix-status — contingência da treeal-pix-status. Mesmo contrato.
 * Aceita `payment_split_id` (preferido) ou `mp_payment_id` (pix_char_*).
 */

interface StatusRequest {
  payment_split_id?: string;
  mp_payment_id?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const config = loadAbacatePayConfig();

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body: StatusRequest = await req.json();
    const { payment_split_id, mp_payment_id } = body;

    let pixId = mp_payment_id;
    let splitRef: { id: string; charge_id: string | null } | null = null;

    if (payment_split_id) {
      const { data: split, error } = await supabase
        .from("payment_splits")
        .select("id, charge_id, mp_payment_id, status, pix_paid_at")
        .eq("id", payment_split_id)
        .single();

      if (error || !split) {
        return json({ error: "Split não encontrado" }, 404);
      }

      if (split.status === "concluded" || split.pix_paid_at) {
        return json({
          success: true,
          status: "PAID",
          internal_status: "concluded",
          pix_paid: true,
          pix_paid_at: split.pix_paid_at,
        });
      }

      splitRef = { id: split.id, charge_id: split.charge_id };
      pixId = pixId || split.mp_payment_id;
    }

    if (!pixId) {
      return json({ error: "mp_payment_id não fornecido" }, 400);
    }
    if (!isAbacatePayId(pixId)) {
      return json({ error: "ID não pertence à AbacatePay (esperado prefixo pix_char_)", mp_payment_id: pixId }, 400);
    }

    console.log("[abacatepay-pix-status] Checking:", pixId);
    const check = await checkPixStatus(config.apiKey, pixId);
    console.log("[abacatepay-pix-status] Status:", check.status);

    let internalStatus: string = mapAbacateStatus(check.status);
    let isPaid = internalStatus === "concluded";
    if (splitRef) {
      const applied = await applyPixStatus(supabase, splitRef, check.status);
      internalStatus = applied.internalStatus;
      isPaid = applied.isPaid;
    }

    return json({
      success: true,
      mp_payment_id: pixId,
      status: check.status,
      internal_status: internalStatus,
      pix_paid: isPaid,
      pix_paid_at: isPaid ? new Date().toISOString() : null,
      expires_at: check.expiresAt,
    });
  } catch (error) {
    console.error("[abacatepay-pix-status] Error:", error);
    return json({ error: "Erro interno ao consultar status PIX", details: String(error) }, 500);
  }
});
