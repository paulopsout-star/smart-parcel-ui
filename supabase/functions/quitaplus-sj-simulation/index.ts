// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, filtrarCondicoes, json, loadSjCharge, sjCardAmount, sjCtx, sjMaxInstallments, sjSimulate, sjToken } from "../_shared/quitaplus-sj.ts";

/**
 * quitaplus-sj-simulation — condições de parcelamento SEM JUROS para uma cobrança.
 *
 * Diferenças em relação a quitaplus-simulation (fluxo atual, intacto):
 *   - recebe { chargeId } ou { paymentLinkId }, nunca valor nem lojista: tudo vem da cobrança;
 *   - só atende cobrança com modalidade = 'sem_juros' (senão { code: 'not_sem_juros' });
 *   - devolve só as parcelas da faixa da cobrança e com parcela ≥ R$ 20,00;
 *   - se o Quita+ devolver acréscimo para o lojista sem juros, responde { code: 'sem_juros_indisponivel' }
 *     e NÃO devolve condições (trava de segurança: nunca cobrar juros numa cobrança sem juros).
 *
 * Resposta compatível com usePaymentSimulation: { success, simulation: { conditions }, semJuros: {...} }.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const loaded = await loadSjCharge(supabase, { chargeId: body?.chargeId, paymentLinkId: body?.paymentLinkId });
    if ("error" in loaded) return json({ success: false, error: loaded.error, code: loaded.code }, 200);
    const { charge } = loaded;

    const ctx = sjCtx();
    if ("error" in ctx) {
      console.error("[quitaplus-sj-simulation] contexto inválido:", ctx.error);
      return json({ success: false, error: "Modalidade sem juros indisponível", code: "sem_juros_config" }, 200);
    }

    const cartaoCents = sjCardAmount(charge);
    const maxParcelas = sjMaxInstallments(charge);
    if (cartaoCents <= 0) return json({ success: false, error: "Cobrança sem valor de cartão", code: "no_card_amount" }, 200);

    console.log("[quitaplus-sj-simulation]", { chargeId: charge.id, cartaoCents, maxParcelas, merchantId: ctx.merchantId });

    const token = await sjToken(ctx);
    const sim = await sjSimulate(ctx, token, cartaoCents);
    if (!sim.ok) {
      console.error("[quitaplus-sj-simulation] Quita+ HTTP", sim.status, sim.body);
      return json({ success: false, error: "Erro na simulação", code: "upstream", httpStatus: sim.status }, 200);
    }

    const { conditions, semAcrescimo } = filtrarCondicoes(sim.conditions, cartaoCents, maxParcelas);
    if (!semAcrescimo) {
      console.error("[quitaplus-sj-simulation] Quita+ devolveu acréscimo para o lojista sem juros", {
        chargeId: charge.id, cartaoCents, amostra: conditions.slice(0, 3),
      });
      return json({
        success: false,
        code: "sem_juros_indisponivel",
        error: "Parcelamento sem juros indisponível no momento. Entre em contato com quem enviou a cobrança.",
      }, 200);
    }

    return json({
      success: true,
      simulation: { conditions },
      semJuros: { chargeId: charge.id, cartaoCents, parcelasMaximas: maxParcelas, merchantId: ctx.merchantId },
    });
  } catch (e) {
    console.error("[quitaplus-sj-simulation] erro:", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
