// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * update-charge — edição de uma cobrança ainda não paga (PIX, cartão ou combinado).
 *
 * Por que uma edge function: o link de pagamento (payment_links) carrega cópia do valor e
 * dos dados do pagador e só aceita UPDATE por service role. Aqui a edição é propagada de
 * forma consistente para charges → payment_links → payment_splits pendentes.
 *
 * Regra de elegibilidade (checada no servidor, não só na UI):
 *   - status da charge em pending/processing
 *   - nenhum split concluded
 *   - nenhum split de cartão com pre_payment_key (cartão já autorizado no Quita+)
 *
 * Se o valor do PIX mudar e já existir QR, o split antigo é CANCELADO (mantendo o
 * mp_payment_id, para que um pagamento tardio do QR antigo continue conciliável) e um
 * novo split pendente é criado com o valor novo.
 */

interface UpdateChargeRequest {
  chargeId: string;
  payer_name: string;
  payer_email: string;
  payer_phone: string;
  payer_document: string;
  amount: number;              // centavos (total)
  pix_amount?: number | null;  // centavos (só cartao_pix)
  card_amount?: number | null; // centavos (só cartao_pix)
  description?: string | null;
  installments?: number | null;
  boleto_linha_digitavel?: string | null;
}

const PIX_FEE_PERCENT = 0.015; // mesma taxa aplicada no checkout
const EDITABLE_STATUSES = ["pending", "processing"];

const onlyDigits = (v: string | null | undefined) => (v || "").replace(/\D/g, "");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (error: string, message: string, status = 400) =>
  json({ success: false, error, message }, status);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ---- Autenticação: usuário logado e com acesso à empresa da cobrança
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail("unauthorized", "Token de autenticação ausente", 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return fail("unauthorized", "Token inválido", 401);

    const body: UpdateChargeRequest = await req.json();
    if (!body.chargeId) return fail("invalid_request", "chargeId é obrigatório");

    const { data: charge, error: chargeError } = await supabase
      .from("charges")
      .select("id, company_id, status, payment_method, amount, pix_amount, card_amount, installments, status_locked_at")
      .eq("id", body.chargeId)
      .maybeSingle();

    if (chargeError || !charge) return fail("not_found", "Cobrança não encontrada", 404);

    const { data: canAccess } = await supabase.rpc("can_access_company", {
      _user_id: user.id,
      _company_id: charge.company_id,
    });
    if (!canAccess) return fail("forbidden", "Sem acesso a esta cobrança", 403);

    // ---- Elegibilidade
    const { data: splits } = await supabase
      .from("payment_splits")
      .select("id, method, status, amount_cents, display_amount_cents, mp_payment_id, pre_payment_key, payment_link_id, order_index, installments")
      .eq("charge_id", charge.id)
      .order("created_at", { ascending: false });

    const allSplits = splits || [];
    if (!EDITABLE_STATUSES.includes(charge.status)) {
      return fail("not_editable", `Cobrança com status "${charge.status}" não pode ser editada`, 409);
    }
    if (allSplits.some((s) => s.status === "concluded")) {
      return fail("not_editable", "Esta cobrança já tem um pagamento concluído", 409);
    }
    if (allSplits.some((s) => s.method === "credit_card" && s.pre_payment_key)) {
      return fail("not_editable", "O cartão desta cobrança já foi autorizado; não é possível editar", 409);
    }

    // ---- Validação dos dados
    const payerName = (body.payer_name || "").trim();
    const payerEmail = (body.payer_email || "").trim();
    const payerPhone = onlyDigits(body.payer_phone);
    const payerDocument = onlyDigits(body.payer_document);
    const amount = Math.round(Number(body.amount));
    const method = charge.payment_method || "cartao";
    const isCombined = method === "cartao_pix";
    const requiresBoleto = method === "cartao" || isCombined;

    if (!payerName) return fail("validation", "Nome do pagador é obrigatório");
    if (!/\S+@\S+\.\S+/.test(payerEmail)) return fail("validation", "E-mail inválido");
    if (payerPhone.length < 10 || payerPhone.length > 11) return fail("validation", "Telefone deve ter 10 ou 11 dígitos");
    if (payerDocument.length !== 11 && payerDocument.length !== 14) return fail("validation", "CPF deve ter 11 dígitos ou CNPJ 14");
    if (!Number.isFinite(amount) || amount <= 0) return fail("validation", "Valor inválido");

    let pixAmount: number | null = null;
    let cardAmount: number | null = null;
    if (isCombined) {
      pixAmount = Math.round(Number(body.pix_amount ?? 0));
      cardAmount = Math.round(Number(body.card_amount ?? 0));
      if (pixAmount <= 0 || cardAmount <= 0) return fail("validation", "Valores de PIX e cartão são obrigatórios");
      if (pixAmount + cardAmount !== amount) return fail("validation", "Soma PIX + Cartão deve ser igual ao total");
    } else if (method === "pix") {
      pixAmount = amount;
    } else {
      cardAmount = amount;
    }

    const installments = Math.max(1, Math.round(Number(body.installments ?? charge.installments ?? 1)));
    const linha = onlyDigits(body.boleto_linha_digitavel);
    if (requiresBoleto) {
      if (linha.length !== 47) return fail("validation", "Linha digitável deve ter exatamente 47 dígitos");
    }
    const description = (body.description || "").trim() || null;

    // ---- 1) charges
    const chargeUpdate: Record<string, unknown> = {
      payer_name: payerName,
      payer_email: payerEmail,
      payer_phone: payerPhone,
      payer_document: payerDocument,
      amount,
      pix_amount: pixAmount,
      card_amount: cardAmount,
      description,
      installments,
    };
    if (requiresBoleto) {
      chargeUpdate.boleto_linha_digitavel = method === "cartao" ? linha : null;
      chargeUpdate.boleto_pix_cartao_linha_digitavel = isCombined ? linha : null;
      chargeUpdate.has_boleto = true;
      chargeUpdate.has_boleto_link = true;
    }

    const { error: updErr } = await supabase.from("charges").update(chargeUpdate).eq("id", charge.id);
    if (updErr) {
      console.error("[update-charge] Erro ao atualizar charge:", updErr);
      return fail("db_error", "Erro ao salvar a cobrança", 500);
    }

    // ---- 2) payment_links (cópia dos dados usada pelo checkout)
    const { error: linkErr } = await supabase
      .from("payment_links")
      .update({
        amount,
        payer_name: payerName,
        payer_email: payerEmail,
        payer_document: payerDocument,
        payer_phone_number: payerPhone,
        description,
        installments,
      })
      .eq("charge_id", charge.id);
    if (linkErr) console.error("[update-charge] Erro ao atualizar payment_links:", linkErr);

    // ---- 3) splits pendentes (só o mais recente de cada método importa para o checkout)
    const latestByMethod = new Map<string, (typeof allSplits)[number]>();
    for (const s of allSplits) if (!latestByMethod.has(s.method)) latestByMethod.set(s.method, s);

    const changes: string[] = [];

    const pixSplit = latestByMethod.get("pix");
    if (pixSplit && pixSplit.status === "pending" && pixAmount !== null) {
      const newDisplay = pixAmount + Math.round(pixAmount * PIX_FEE_PERCENT);
      if (pixSplit.amount_cents !== pixAmount) {
        if (pixSplit.mp_payment_id) {
          // QR já emitido com outro valor: cancela e cria um novo split pendente
          await supabase.from("payment_splits").update({ status: "cancelled", mp_status_detail: "cancelado: valor editado" }).eq("id", pixSplit.id);
          const { error: insErr } = await supabase.from("payment_splits").insert({
            charge_id: charge.id,
            payment_link_id: pixSplit.payment_link_id,
            method: "pix",
            amount_cents: pixAmount,
            display_amount_cents: newDisplay,
            status: "pending",
            order_index: pixSplit.order_index ?? 1,
          });
          if (insErr) console.error("[update-charge] Erro ao criar novo split PIX:", insErr);
          changes.push("qr_pix_regenerado");
        } else {
          await supabase.from("payment_splits").update({ amount_cents: pixAmount, display_amount_cents: newDisplay }).eq("id", pixSplit.id);
          changes.push("split_pix_atualizado");
        }
      }
    }

    const cardSplit = latestByMethod.get("credit_card");
    if (cardSplit && cardSplit.status === "pending" && cardAmount !== null) {
      if (cardSplit.amount_cents !== cardAmount || (cardSplit.installments ?? 1) !== installments) {
        await supabase
          .from("payment_splits")
          .update({ amount_cents: cardAmount, display_amount_cents: null, installments })
          .eq("id", cardSplit.id);
        changes.push("split_cartao_atualizado");
      }
    }

    console.log("[update-charge] Cobrança editada:", { chargeId: charge.id, user: user.id, method, amount, changes });

    const { data: updated } = await supabase.from("charges").select("*").eq("id", charge.id).single();
    return json({ success: true, charge: updated, changes });
  } catch (error) {
    console.error("[update-charge] Error:", error);
    return fail("internal_error", "Erro interno ao editar a cobrança", 500);
  }
});
