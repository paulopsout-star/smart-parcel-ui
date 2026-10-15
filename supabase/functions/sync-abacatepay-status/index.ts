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
 * sync-abacatepay-status — equivalente da sync-treeal-status para QRs AbacatePay (v2).
 *
 * Varre splits PIX pendentes dos últimos 7 dias cujo mp_payment_id tem prefixo
 * "pix_char_" e consulta o status de cada um. Deve rodar via cron a cada 5 min
 * (ver migration cron_sync_abacatepay_status) e pelo botão "Sincronizar" do admin.
 */

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

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingSplits, error: fetchError } = await supabase
      .from("payment_splits")
      .select("id, mp_payment_id, charge_id")
      .eq("method", "pix")
      .eq("status", "pending")
      .like("mp_payment_id", "pix_char_%")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("[sync-abacatepay-status] Error fetching pending splits:", fetchError);
      return json({ error: "Erro ao buscar splits pendentes" }, 500);
    }

    const splits = (pendingSplits || []).filter((s) => isAbacatePayId(s.mp_payment_id));
    if (splits.length === 0) {
      console.log("[sync-abacatepay-status] No pending AbacatePay PIX splits to sync");
      return json({ success: true, synced: 0, message: "Nenhum PIX AbacatePay pendente" });
    }

    console.log(`[sync-abacatepay-status] Syncing ${splits.length} pending AbacatePay PIX payments`);

    let synced = 0;
    let approved = 0;
    let failed = 0;
    const errors: string[] = [];
    const updatedChargeIds = new Set<string>();

    for (const split of splits) {
      try {
        const check = await checkPixStatus(config.apiKey, split.mp_payment_id);
        const { internalStatus, isPaid } = await applyPixStatus(supabase, split, check.status);
        synced++;

        if (isPaid) approved++;
        else if (internalStatus === "failed") failed++;

        if (internalStatus !== "pending" && split.charge_id) {
          updatedChargeIds.add(split.charge_id);
        }

        console.log(`[sync-abacatepay-status] Split ${split.id}: ${check.status} → ${internalStatus}`);

        // Pequena pausa para não bater em rate limit
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[sync-abacatepay-status] Split ${split.id}:`, error);
        errors.push(`Split ${split.id}: ${String(error)}`);
      }
    }

    return json({
      success: true,
      synced,
      approved,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      updatedChargeIds: Array.from(updatedChargeIds),
    });
  } catch (error) {
    console.error("[sync-abacatepay-status] Fatal error:", error);
    return json({ error: "Erro interno", details: String(error) }, 500);
  }
});
