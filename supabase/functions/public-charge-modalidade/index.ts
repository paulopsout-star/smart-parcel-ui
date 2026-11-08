// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * public-charge-modalidade — diz ao checkout público qual é a modalidade de uma cobrança.
 *
 * Só lê o banco (sem Quita+). Entrada: GET ?id=<payment_link.id | charge.id> ou POST { id }.
 * Saída: { modalidade: 'com_juros' | 'sem_juros', chargeId, semJuros?: { parcelasMaximas, cartaoCents } }.
 * Para id desconhecido responde com_juros, que é o comportamento atual do checkout.
 *
 * Existe para o checkout decidir entre as funções atuais e as `quitaplus-sj-*` sem que nenhuma
 * função atual precise mudar.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let id = new URL(req.url).searchParams.get("id") || "";
    if (!id && req.method === "POST") id = String((await req.json().catch(() => ({})))?.id || "");
    if (!uuid.test(id)) return json({ modalidade: "com_juros", chargeId: null });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let chargeId = id;
    const { data: link } = await supabase.from("payment_links").select("charge_id").eq("id", id).maybeSingle();
    if (link?.charge_id) chargeId = link.charge_id;

    const { data: charge } = await supabase.from("charges").select("id, modalidade, metadata").eq("id", chargeId).maybeSingle();
    if (!charge) return json({ modalidade: "com_juros", chargeId: null });

    if (charge.modalidade !== "sem_juros") return json({ modalidade: "com_juros", chargeId: charge.id });

    const sj = (charge.metadata?.sem_juros ?? {}) as Record<string, unknown>;
    return json({
      modalidade: "sem_juros",
      chargeId: charge.id,
      semJuros: {
        parcelasMaximas: Math.min(12, Math.max(1, Number(sj.parcelas_maximas) || 1)),
        cartaoCents: Number(sj.cartao_cents) || 0,
      },
    });
  } catch (e) {
    console.error("[public-charge-modalidade]", e);
    return json({ modalidade: "com_juros", chargeId: null, error: "erro_interno" });
  }
});
