// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  corsHeaders, digits, extractUserFriendlyMessage, filtrarCondicoes, json, loadSjCharge, quitaHeaders,
  registrarUsoSj, sjAttachBankslip, sjCardAmount, sjCtx, sjMaxInstallments, SJ_PARCELA_MINIMA_CENTS, sjSimulate, sjToken,
} from "../_shared/quitaplus-sj.ts";

/**
 * quitaplus-sj-prepayment — pré-autorização no cartão para cobrança SEM JUROS.
 *
 * Mesmo contrato de entrada e de saída de quitaplus-prepayment (fluxo atual, intacto), para o
 * checkout só trocar o nome da função:
 *   { chargeId, paymentLinkId, amount (centavos), installments, card, cardHolder }
 *   → { success, prePaymentKey, boletoLinked, linkBoletoError, apiRawResponse, apiMetadata } | { success:false, error, userMessage }
 *
 * Diferenças:
 *   - só atende cobrança com modalidade = 'sem_juros';
 *   - credencial, MerchantId e CreditorDocument fixos do CNPJ sem juros (combinação comprovada);
 *   - valida parcelas contra a faixa da cobrança e a parcela mínima, e o valor contra o cartão da simulação;
 *   - antes de autorizar, simula e exige acréscimo zero na condição escolhida (trava: nunca cobrar juros);
 *   - UMA tentativa na autorização (sem retry em 5xx): em timeout o estado é desconhecido e não se repete;
 *   - grava em metadata.quitaplus_sj o que foi usado.
 */

const onlyDigits = digits;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const requestData = await req.json().catch(() => ({}));
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ---- cobrança sem juros ----
    const loaded = await loadSjCharge(supabase, { chargeId: requestData?.chargeId, paymentLinkId: requestData?.paymentLinkId });
    if ("error" in loaded) {
      return json({ success: false, error: loaded.code, userMessage: loaded.error }, 200);
    }
    const { charge } = loaded;
    const paymentLinkId = String(requestData?.paymentLinkId || "");

    const ctx = sjCtx();
    if ("error" in ctx) {
      console.error("[quitaplus-sj-prepayment] contexto inválido:", ctx.error);
      return json({ success: false, error: "sem_juros_config", userMessage: "Pagamento sem juros indisponível no momento." }, 200);
    }

    // ---- validações da modalidade ----
    const cartaoCents = sjCardAmount(charge);
    const maxParcelas = sjMaxInstallments(charge);
    const installments = Math.round(Number(requestData?.installments || 1));
    const amount = Math.round(Number(requestData?.amount || 0));

    if (!(installments >= 1 && installments <= maxParcelas)) {
      return json({ success: false, error: "installments_out_of_range", userMessage: `Esta cobrança permite até ${maxParcelas}x sem juros.` }, 200);
    }
    if (installments > 1 && Math.floor(cartaoCents / installments) < SJ_PARCELA_MINIMA_CENTS) {
      return json({ success: false, error: "installment_below_minimum", userMessage: "Parcela abaixo de R$ 20,00." }, 200);
    }
    if (amount !== cartaoCents) {
      console.error("[quitaplus-sj-prepayment] valor divergente", { amount, cartaoCents, chargeId: charge.id });
      return json({ success: false, error: "amount_mismatch", userMessage: "Valor do pagamento diferente do valor da cobrança. Recarregue a página." }, 200);
    }

    // ---- pagador: sempre do cadastro da cobrança ----
    const payer = {
      name: (charge.payer_name || "").trim(),
      document: onlyDigits(charge.payer_document),
      email: (charge.payer_email || "").trim(),
      phoneNumber: onlyDigits(charge.payer_phone) || onlyDigits(requestData?.cardHolder?.phone),
    };
    if (!payer.name || !payer.document || !payer.email || !payer.phoneNumber) {
      return json({ success: false, error: "payer_data_incomplete", userMessage: "O cadastro desta cobrança está incompleto (nome, CPF/CNPJ, e-mail ou telefone). Entre em contato com quem enviou o link." }, 200);
    }

    // ---- cartão ----
    const card = requestData?.card || {};
    const cardNumber = onlyDigits(card.number);
    const cvv = onlyDigits(card.cvv);
    const exp = onlyDigits(card.expirationDate);
    if (!(cardNumber.length >= 13 && cardNumber.length <= 19) || !(cvv.length >= 3 && cvv.length <= 4) || exp.length !== 4 || !String(card.holderName || "").trim()) {
      return json({ success: false, error: "invalid_card", userMessage: "Dados do cartão inválidos. Verifique e tente novamente." }, 200);
    }
    const cardExpirationDate = `20${exp.slice(2)}/${exp.slice(0, 2)}`;

    // ---- trava: a condição escolhida precisa estar sem acréscimo no Quita+ agora ----
    const token = await sjToken(ctx);
    const sim = await sjSimulate(ctx, token, cartaoCents);
    if (!sim.ok) {
      return json({ success: false, error: "simulation_failed", userMessage: "Erro temporário ao validar o parcelamento. Tente novamente." }, 200);
    }
    const { conditions, semAcrescimo } = filtrarCondicoes(sim.conditions, cartaoCents, maxParcelas);
    const escolhida = conditions.find((c) => c.installments === installments);
    if (!semAcrescimo || !escolhida) {
      console.error("[quitaplus-sj-prepayment] condição sem juros indisponível", { chargeId: charge.id, installments, semAcrescimo, amostra: conditions.slice(0, 3) });
      return json({ success: false, error: "sem_juros_indisponivel", userMessage: "Parcelamento sem juros indisponível no momento. Entre em contato com quem enviou a cobrança." }, 200);
    }

    // ---- autorização (tentativa única) ----
    const payload = {
      MerchantId: ctx.merchantId,
      CreditorName: ctx.creditorName,
      CreditorDocument: ctx.creditorDocument,
      AmountInCents: cartaoCents,
      Installments: installments,
      PayerDocument: payer.document,
      PayerEmail: payer.email,
      PayerPhoneNumber: payer.phoneNumber,
      PayerName: payer.name,
      CardHolderName: String(card.holderName).trim(),
      CardNumber: cardNumber,
      CardExpirationDate: cardExpirationDate,
      CardCvv: cvv,
    };
    const fullUrl = `${ctx.baseUrl}/prepayment/authorize`;
    console.log("[quitaplus-sj-prepayment] autorizando", { chargeId: charge.id, AmountInCents: cartaoCents, Installments: installments, MerchantId: ctx.merchantId, CreditorDocument: ctx.creditorDocument });

    let quitaResponse: Response;
    try {
      quitaResponse = await fetch(fullUrl, { method: "POST", headers: quitaHeaders(token), body: JSON.stringify(payload), signal: AbortSignal.timeout(45_000) });
    } catch (e) {
      console.error("[quitaplus-sj-prepayment] falha de rede/timeout na autorização (estado desconhecido):", e);
      await registrarUsoSj(supabase, charge.id, ctx, { erro: "timeout_autorizacao", em: new Date().toISOString() });
      return json({ success: false, error: "authorize_timeout", userMessage: "Não foi possível confirmar a autorização. Aguarde alguns minutos e consulte quem enviou a cobrança antes de tentar de novo." }, 200);
    }
    const responseText = await quitaResponse.text();
    const apiMetadata = { httpStatus: quitaResponse.status, httpStatusText: quitaResponse.statusText, requestUrl: fullUrl };
    console.log("[quitaplus-sj-prepayment] resposta", { status: quitaResponse.status, body: responseText.slice(0, 500) });

    if (!quitaResponse.ok) {
      return json({ success: false, error: "payment_failed", userMessage: extractUserFriendlyMessage(responseText, quitaResponse.status), apiRawResponse: responseText, apiMetadata }, 200);
    }

    let quitaData: Record<string, unknown> = {};
    try { quitaData = JSON.parse(responseText); } catch { /* texto */ }
    const prePaymentKey = (quitaData.prePaymentKey ?? quitaData.pre_payment_key ?? quitaData.PrePaymentKey ?? null) as string | null;
    const isApproved = (quitaData.isApproved ?? quitaData.IsApproved ?? false) === true;
    const apiMessage = String(quitaData.message ?? quitaData.Message ?? quitaData.returnMessage ?? quitaData.ReturnMessage ?? "");

    if (!prePaymentKey) {
      return json({ success: false, error: "prepayment_key_missing", userMessage: extractUserFriendlyMessage(responseText, quitaResponse.status), isApproved: false, apiRawResponse: responseText, apiMetadata }, 200);
    }

    // ---- banco: mesmos efeitos do fluxo atual ----
    const splitStatus = isApproved ? "pending" : "failed";
    if (paymentLinkId) {
      const { error } = await supabase.from("payment_splits")
        .update({ pre_payment_key: prePaymentKey, authorization_code: quitaData.authorizationCode ?? quitaData.authorization_code ?? null, status: splitStatus })
        .eq("payment_link_id", paymentLinkId).eq("method", "credit_card");
      if (error) console.error("[quitaplus-sj-prepayment] payment_splits:", error);
    }

    // Portador do cartão (nunca vai ao Quita+ além do nome). Falha aqui não interrompe.
    const holder = requestData?.cardHolder;
    if (holder && charge.company_id) {
      try {
        const { data: cardSplit } = await supabase.from("payment_splits").select("id, payment_link_id")
          .eq("charge_id", charge.id).eq("method", "credit_card").order("created_at", { ascending: false }).limit(1).maybeSingle();
        await supabase.from("card_holder_details").insert({
          company_id: charge.company_id,
          charge_id: charge.id,
          payment_link_id: cardSplit?.payment_link_id ?? null,
          payment_split_id: cardSplit?.id ?? null,
          pre_payment_key: prePaymentKey,
          holder_name: (holder.name || card.holderName || "").trim(),
          holder_document: onlyDigits(holder.document),
          holder_birth_date: holder.birthDate || null,
          holder_phone: onlyDigits(holder.phone) || null,
          holder_email: (holder.email || "").trim() || null,
          relationship: holder.relationship,
        });
      } catch (e) {
        console.error("[quitaplus-sj-prepayment] card_holder_details:", e);
      }
    }

    if (!isApproved) {
      await supabase.from("charges").update({ pre_payment_key: prePaymentKey, status: "payment_denied" }).eq("id", charge.id);
      await registrarUsoSj(supabase, charge.id, ctx, { pre_payment_key: prePaymentKey, aprovado: false, parcelas: installments, em: new Date().toISOString() });
      return json({ success: false, error: "payment_not_approved", userMessage: apiMessage || extractUserFriendlyMessage(responseText, quitaResponse.status), prePaymentKey, isApproved: false, apiRawResponse: responseText, apiMetadata }, 200);
    }

    await supabase.from("charges")
      .update({ pre_payment_key: prePaymentKey, payment_authorized_at: new Date().toISOString(), status: "pre_authorized" })
      .eq("id", charge.id);
    await registrarUsoSj(supabase, charge.id, ctx, {
      pre_payment_key: prePaymentKey, aprovado: true, parcelas: installments, valor_cents: cartaoCents,
      total_condicao_cents: escolhida.totalAmount, em: new Date().toISOString(),
    });

    // ---- boleto: só-cartão vincula agora com a credencial sem juros; combinado segue o fluxo atual (manual/Inter) ----
    let boletoLinked = false;
    let linkBoletoError: string | null = null;
    if (charge.payment_method === "cartao" && charge.boleto_linha_digitavel) {
      try {
        const r = await sjAttachBankslip(ctx, token, prePaymentKey, charge.boleto_linha_digitavel);
        if (r.ok) {
          boletoLinked = true;
          await supabase.from("charges").update({ status: "boleto_linked", boleto_linked_at: new Date().toISOString() }).eq("id", charge.id);
          if (paymentLinkId) {
            await supabase.from("payment_splits").update({ link_id: r.data?.linkId ?? r.data?.link_id ?? null, status: "linked" })
              .eq("payment_link_id", paymentLinkId).eq("pre_payment_key", prePaymentKey);
          }
        } else {
          linkBoletoError = `HTTP ${r.status}: ${r.text.slice(0, 200)}`;
        }
      } catch (e) {
        linkBoletoError = e instanceof Error ? e.message : "Erro ao vincular boleto";
      }
      if (linkBoletoError) {
        console.error("[quitaplus-sj-prepayment] vínculo do boleto falhou:", linkBoletoError);
        const { data: cur } = await supabase.from("charges").select("metadata").eq("id", charge.id).maybeSingle();
        await supabase.from("charges").update({
          metadata: { ...((cur?.metadata as Record<string, unknown>) || {}), link_boleto_error: { message: linkBoletoError, attemptedAt: new Date().toISOString() } },
        }).eq("id", charge.id);
      }
    } else if (charge.payment_method === "cartao_pix" && Deno.env.get("INTER_AUTO_ISSUE") === "true") {
      const issue = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/inter-boleto-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ chargeId: charge.id, source: "sj-prepayment" }),
      }).then(async (r) => console.log("[quitaplus-sj-prepayment] inter-boleto-issue:", r.status, (await r.text()).slice(0, 200)))
        .catch((e) => console.error("[quitaplus-sj-prepayment] inter-boleto-issue falhou:", e));
      const rt = (globalThis as any).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(issue); else await issue;
    }

    return json({ success: true, modalidade: "sem_juros", prePaymentKey, boletoLinked, linkBoletoError, apiRawResponse: responseText, apiMetadata });
  } catch (e) {
    console.error("[quitaplus-sj-prepayment] erro fatal:", e);
    return json({ success: false, error: "internal_error", userMessage: "Erro temporário. Por favor, tente novamente.", code: 500 }, 200);
  }
});
