// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * update-charge — edição de uma cobrança Pendente (PIX, cartão ou combinado).
 *
 * Por que uma edge function: o link de pagamento (payment_links) carrega cópia do valor e
 * dos dados do pagador e só aceita UPDATE por service role. Aqui a edição é propagada de
 * forma consistente para charges → payment_links → payment_splits.
 *
 * Elegibilidade (checada no servidor, não só na UI):
 *   - status da charge exatamente "pending"
 *   - cartão não pago nem autorizado (sem split credit_card concluded / com pre_payment_key)
 *   - PIX já pago NÃO bloqueia no combinado: fica travado e o saldo pode ser redistribuído
 *     entre um novo PIX e o cartão. Regra: PIX pago + novo PIX + cartão = total.
 *   - troca de tipo de pagamento só enquanto nada foi pago
 *
 * Splits PIX:
 *   - novo PIX > 0 sem split pendente → cria um split pendente (QR gerado ao abrir o link)
 *   - novo PIX > 0 com split pendente de outro valor → atualiza; se já tinha QR, cancela o
 *     antigo (mantendo o mp_payment_id para conciliação tardia) e cria outro
 *   - novo PIX = 0 com split pendente → cancela o split pendente
 *
 * Troca de tipo de pagamento: cancela os splits pendentes do método que saiu, cria os do
 * método que entrou (se o link já foi aberto) e recalcula a URL do checkout
 * (/checkout-pix/<charge> para PIX; /checkout/<link> para cartão e combinado).
 */

interface UpdateChargeRequest {
  chargeId: string;
  payment_method?: string | null;
  payer_name: string;
  payer_email: string;
  payer_phone: string;
  payer_document: string;
  amount: number;              // centavos (total)
  pix_amount?: number | null;  // centavos — parte do PIX AINDA A PAGAR (só cartao_pix)
  card_amount?: number | null; // centavos (só cartao_pix)
  description?: string | null;
  installments?: number | null;
  boleto_linha_digitavel?: string | null;
}

const PIX_FEE_PERCENT = 0.015; // mesma taxa aplicada no checkout
const EDITABLE_STATUSES = ["pending"];
const METHODS = ["pix", "cartao", "cartao_pix"];
const PRODUCTION_DOMAIN = "https://pay1.autonegocie.com";

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
      .select("id, company_id, status, payment_method, amount, pix_amount, card_amount, installments, status_locked_at, checkout_link_id")
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
    const currentMethod = METHODS.includes(charge.payment_method) ? charge.payment_method : "cartao";
    const method = METHODS.includes(body.payment_method) ? body.payment_method : currentMethod;
    const methodChanged = method !== currentMethod;
    const isCombined = method === "cartao_pix";
    const allowsPix = method === "pix" || isCombined;
    const allowsCard = method === "cartao" || isCombined;
    const requiresBoleto = allowsCard;

    if (!EDITABLE_STATUSES.includes(charge.status)) {
      return fail("not_editable", `Somente cobranças Pendentes podem ser editadas (status atual: ${charge.status})`, 409);
    }
    const cardSplits = allSplits.filter((s) => s.method === "credit_card");
    if (cardSplits.some((s) => s.status === "concluded")) {
      return fail("not_editable", "O cartão desta cobrança já foi pago", 409);
    }
    if (cardSplits.some((s) => s.pre_payment_key)) {
      return fail("not_editable", "O cartão desta cobrança já foi autorizado; não é possível editar", 409);
    }
    const paidPixSplits = allSplits.filter((s) => s.method === "pix" && s.status === "concluded");
    const paidPix = paidPixSplits.reduce((sum, s) => sum + (s.amount_cents || 0), 0);
    if (paidPix > 0 && currentMethod !== "cartao_pix") {
      return fail("not_editable", "Esta cobrança PIX já foi paga", 409);
    }
    if (methodChanged && paidPix > 0) {
      return fail("not_editable", "Já existe PIX pago; o tipo de pagamento não pode ser alterado", 409);
    }

    // ---- Validação dos dados
    const payerName = (body.payer_name || "").trim();
    const payerEmail = (body.payer_email || "").trim();
    const payerPhone = onlyDigits(body.payer_phone);
    const payerDocument = onlyDigits(body.payer_document);
    const amount = Math.round(Number(body.amount));

    if (!payerName) return fail("validation", "Nome do pagador é obrigatório");
    if (!/\S+@\S+\.\S+/.test(payerEmail)) return fail("validation", "E-mail inválido");
    if (payerPhone.length < 10 || payerPhone.length > 11) return fail("validation", "Telefone deve ter 10 ou 11 dígitos");
    if (payerDocument.length !== 11 && payerDocument.length !== 14) return fail("validation", "CPF deve ter 11 dígitos ou CNPJ 14");
    if (!Number.isFinite(amount) || amount <= 0) return fail("validation", "Valor inválido");

    // pendingPix = parte do PIX ainda a pagar; pixAmount (charges.pix_amount) = pago + pendente
    let pendingPix = 0;
    let pixAmount: number | null = null;
    let cardAmount: number | null = null;
    if (isCombined) {
      pendingPix = Math.max(0, Math.round(Number(body.pix_amount ?? 0)));
      cardAmount = Math.round(Number(body.card_amount ?? 0));
      if (paidPix === 0 && pendingPix <= 0) return fail("validation", "Valor do PIX é obrigatório");
      if (cardAmount <= 0) return fail("validation", "Valor do cartão é obrigatório");
      if (paidPix + pendingPix + cardAmount !== amount) {
        return fail("validation", `PIX pago (${paidPix}) + novo PIX (${pendingPix}) + cartão (${cardAmount}) deve ser igual ao total (${amount})`);
      }
      pixAmount = paidPix + pendingPix;
    } else if (method === "pix") {
      pixAmount = amount;
      pendingPix = amount;
    } else {
      cardAmount = amount;
    }

    const installments = allowsCard
      ? Math.max(1, Math.round(Number(body.installments ?? charge.installments ?? 1)))
      : 1;
    const linha = onlyDigits(body.boleto_linha_digitavel);
    if (requiresBoleto && linha.length !== 47) {
      return fail("validation", "Linha digitável deve ter exatamente 47 dígitos");
    }
    const description = (body.description || "").trim() || null;

    // ---- Link de pagamento ativo (usado para URL do checkout e para novos splits)
    const { data: activeLink } = await supabase
      .from("payment_links")
      .select("id")
      .eq("charge_id", charge.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const linkId: string | null = activeLink?.id ?? allSplits.find((s) => s.payment_link_id)?.payment_link_id ?? null;

    // ---- 1) charges
    const chargeUpdate: Record<string, unknown> = {
      payment_method: method,
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
    } else {
      chargeUpdate.boleto_linha_digitavel = null;
      chargeUpdate.boleto_pix_cartao_linha_digitavel = null;
      chargeUpdate.has_boleto = false;
      chargeUpdate.has_boleto_link = false;
    }
    if (methodChanged) {
      // A rota do checkout depende do método: PIX puro usa o id da cobrança; os demais, o id do link
      const origin = Deno.env.get("APP_ORIGIN") || PRODUCTION_DOMAIN;
      if (method === "pix") {
        chargeUpdate.checkout_url = `${origin}/checkout-pix/${charge.id}`;
      } else if (linkId) {
        chargeUpdate.checkout_url = `${origin}/checkout/${linkId}`;
        chargeUpdate.checkout_link_id = linkId;
      } else {
        chargeUpdate.checkout_url = null; // charge-links gera sob demanda no painel
      }
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
        order_type: method,
      })
      .eq("charge_id", charge.id);
    if (linkErr) console.error("[update-charge] Erro ao atualizar payment_links:", linkErr);

    // ---- 3) splits
    const changes: string[] = [];
    if (methodChanged) changes.push("metodo_alterado");

    const cancelPending = async (splitMethod: string, reason: string) => {
      const ids = allSplits.filter((s) => s.method === splitMethod && s.status === "pending").map((s) => s.id);
      if (ids.length === 0) return;
      await supabase.from("payment_splits").update({ status: "cancelled", mp_status_detail: reason }).in("id", ids);
    };

    const insertPendingPix = async (cents: number, orderIndex: number) => {
      const { error } = await supabase.from("payment_splits").insert({
        charge_id: charge.id,
        payment_link_id: linkId,
        method: "pix",
        amount_cents: cents,
        display_amount_cents: cents + Math.round(cents * PIX_FEE_PERCENT),
        status: "pending",
        order_index: orderIndex,
      });
      if (error) console.error("[update-charge] Erro ao criar split PIX:", error);
    };

    const insertPendingCard = async (cents: number, orderIndex: number) => {
      const { error } = await supabase.from("payment_splits").insert({
        charge_id: charge.id,
        payment_link_id: linkId,
        method: "credit_card",
        amount_cents: cents,
        display_amount_cents: null,
        installments,
        status: "pending",
        order_index: orderIndex,
      });
      if (error) console.error("[update-charge] Erro ao criar split cartão:", error);
    };

    // Métodos que saíram com a troca de tipo
    if (!allowsPix) await cancelPending("pix", "cancelado: tipo de pagamento alterado");
    if (!allowsCard) await cancelPending("credit_card", "cancelado: tipo de pagamento alterado");

    // Só mexe em splits se o link já foi aberto (allSplits > 0); antes disso o Checkout cria a partir da charge
    const hasSplits = allSplits.length > 0;

    if (allowsPix && hasSplits) {
      const pendingPixSplit = allSplits.find((s) => s.method === "pix" && s.status === "pending"); // mais recente
      if (pendingPix > 0) {
        if (!pendingPixSplit) {
          await insertPendingPix(pendingPix, 1);
          changes.push(methodChanged ? "split_pix_criado" : "novo_pix_criado");
        } else if (pendingPixSplit.amount_cents !== pendingPix) {
          const newDisplay = pendingPix + Math.round(pendingPix * PIX_FEE_PERCENT);
          if (pendingPixSplit.mp_payment_id) {
            // QR já emitido com outro valor: cancela e cria um novo split pendente
            await supabase.from("payment_splits").update({ status: "cancelled", mp_status_detail: "cancelado: valor editado" }).eq("id", pendingPixSplit.id);
            await insertPendingPix(pendingPix, pendingPixSplit.order_index ?? 1);
            changes.push("qr_pix_regenerado");
          } else {
            await supabase.from("payment_splits").update({ amount_cents: pendingPix, display_amount_cents: newDisplay }).eq("id", pendingPixSplit.id);
            changes.push("split_pix_atualizado");
          }
        }
      } else if (pendingPixSplit) {
        // Nada mais a pagar por PIX: o split pendente sai de cena
        await supabase.from("payment_splits").update({ status: "cancelled", mp_status_detail: "cancelado: sem saldo PIX após edição" }).eq("id", pendingPixSplit.id);
        changes.push("pix_pendente_cancelado");
      }
    }

    if (allowsCard && hasSplits && cardAmount !== null) {
      const cardSplit = cardSplits.find((s) => s.status === "pending");
      if (!cardSplit) {
        await insertPendingCard(cardAmount, allowsPix ? 2 : 1);
        changes.push("split_cartao_criado");
      } else if (cardSplit.amount_cents !== cardAmount || (cardSplit.installments ?? 1) !== installments) {
        await supabase
          .from("payment_splits")
          .update({ amount_cents: cardAmount, display_amount_cents: null, installments })
          .eq("id", cardSplit.id);
        changes.push("split_cartao_atualizado");
      }
    }

    console.log("[update-charge] Cobrança editada:", { chargeId: charge.id, user: user.id, method, methodChanged, amount, paidPix, pendingPix, cardAmount, changes });

    const { data: updated } = await supabase.from("charges").select("*").eq("id", charge.id).single();
    return json({ success: true, charge: updated, changes });
  } catch (error) {
    console.error("[update-charge] Error:", error);
    return fail("internal_error", "Erro interno ao editar a cobrança", 500);
  }
});
