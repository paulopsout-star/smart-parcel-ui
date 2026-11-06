// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";
import {
  applyPixStatus,
  checkPixStatus,
  isAbacatePayId,
  loadAbacatePayConfig,
  mapAbacateStatus,
  markSplitRefunded,
} from "../_shared/abacatepay.ts";

/**
 * sync-abacatepay-status — equivalente da sync-treeal-status para QRs AbacatePay (v2).
 *
 * Varre splits PIX pendentes com QR AbacatePay (prefixo "pix_char_") cuja validade
 * ainda está dentro da janela e consulta o status de cada um. Deve rodar via cron a cada 5 min
 * (ver migration cron_sync_abacatepay_status) e pelo botão "Sincronizar" do admin.
 *
 * Modo reconciliação — body `{ "reconcile": true, "days"?: number }`:
 * reconsulta os PIX AbacatePay já PAGOS (concluded) dos últimos N dias (padrão 120) e marca como
 * estornados os que a AbacatePay devolve como REFUNDED. Cobre estornos feitos no painel da
 * AbacatePay cujo webhook não chegou ou foi perdido. Roda 1x/dia via cron
 * (ver migration cron_reconcile_abacatepay_refunds).
 */

const RECONCILE_DEFAULT_DAYS = 120;
const RECONCILE_MAX_SPLITS = 400;
const RECONCILE_CONCURRENCY = 4;

async function reconcilePaidSplits(supabase: any, apiKey: string, opts: any) {
  const days = Math.min(Math.max(Number(opts?.days) || RECONCILE_DEFAULT_DAYS, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("payment_splits")
    .select("id, mp_payment_id, charge_id")
    .eq("method", "pix")
    .eq("status", "concluded")
    .like("mp_payment_id", "pix_char_%")
    .gte("processed_at", since)
    .order("processed_at", { ascending: false })
    .limit(RECONCILE_MAX_SPLITS);

  if (error) {
    console.error("[sync-abacatepay-status] reconcile: erro ao buscar splits pagos:", error);
    return { success: false, mode: "reconcile", error: "Erro ao buscar splits pagos" };
  }

  const queue = (data || []).filter((s: any) => isAbacatePayId(s.mp_payment_id));
  const total = queue.length;
  let checked = 0;
  const refundedSplits: string[] = [];
  const errors: string[] = [];

  const worker = async () => {
    while (queue.length > 0) {
      const split = queue.shift();
      try {
        const check = await checkPixStatus(apiKey, split.mp_payment_id);
        checked++;
        if (mapAbacateStatus(check.status) === "refunded") {
          const changed = await markSplitRefunded(supabase, split);
          if (changed) {
            refundedSplits.push(split.id);
            console.log(`[sync-abacatepay-status] reconcile: split ${split.id} (${split.mp_payment_id}) estornado na AbacatePay`);
          }
        }
      } catch (e) {
        errors.push(`Split ${split.id}: ${String(e)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: RECONCILE_CONCURRENCY }, worker));

  console.log(`[sync-abacatepay-status] reconcile: ${checked}/${total} conferidos, ${refundedSplits.length} estornos aplicados`);
  return {
    success: true,
    mode: "reconcile",
    days,
    total,
    checked,
    refunded: refundedSplits.length,
    refundedSplits,
    errors: errors.length > 0 ? errors : undefined,
  };
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

    let body: any = {};
    try { body = await req.json(); } catch { /* cron envia {} ou corpo vazio */ }
    if (body?.reconcile === true) {
      return json(await reconcilePaidSplits(supabase, config.apiKey, body));
    }

    // Janela pela VALIDADE do QR, não pela data do split: um split antigo pode receber um QR novo
    // (reabertura do link) e precisa continuar sendo sincronizado. QRs vencidos há mais de 3 dias
    // já foram marcados como failed numa varredura anterior.
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingSplits, error: fetchError } = await supabase
      .from("payment_splits")
      .select("id, mp_payment_id, charge_id")
      .eq("method", "pix")
      .eq("status", "pending")
      .like("mp_payment_id", "pix_char_%")
      .or(`mp_date_of_expiration.is.null,mp_date_of_expiration.gte.${threeDaysAgo}`)
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
