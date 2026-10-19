// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";
import { abacateRequest, isAbacatePayId, loadAbacatePayConfig } from "../_shared/abacatepay.ts";

/**
 * abacatepay-pix-create — contingência da treeal-pix-create.
 * Mesmo contrato de request/response, para o front alternar provedor sem mudar o fluxo.
 */

interface CreatePixRequest {
  payment_split_id?: string;
  charge_id?: string;
  amount_cents: number;
  payer_name: string;
  payer_email?: string;
  payer_document: string;
  payer_phone?: string | null;
  description?: string;
}

interface AbacatePixData {
  id: string;
  amount: number;
  status: string;
  devMode: boolean;
  brCode: string;
  brCodeBase64: string;
  receiptUrl?: string | null;
  expiresAt?: string;
}

const PIX_EXPIRATION_SECONDS = 86400; // 24h, igual à Treeal
const ABACATE_MIN_AMOUNT_CENTS = 100;
const PIX_DESCRIPTION = "Pagamento PIX - Autonegocie";

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
    const body: CreatePixRequest = await req.json();
    const {
      payment_split_id,
      charge_id,
      amount_cents,
      payer_name,
      payer_email,
      payer_document,
      payer_phone,
      description,
    } = body;

    if (!amount_cents || amount_cents <= 0) {
      return json({ error: "Valor inválido" }, 400);
    }
    if (amount_cents < ABACATE_MIN_AMOUNT_CENTS) {
      return json({ error: "Valor mínimo para PIX via AbacatePay é R$ 1,00" }, 400);
    }
    if (!payer_name || !payer_document) {
      return json({ error: "Dados do pagador incompletos" }, 400);
    }

    // Não gerar novo QR se a charge já foi quitada (mesma proteção da Treeal)
    if (charge_id) {
      const { data: charge } = await supabase
        .from("charges")
        .select("status, completed_at")
        .eq("id", charge_id)
        .maybeSingle();

      if (charge?.status === "completed") {
        console.log(`[abacatepay-pix-create] Charge ${charge_id} já está completed — recusando gerar novo QR`);
        return json({
          error: "charge_already_completed",
          message: "Esta cobrança já foi paga. Não é possível gerar novo QR Code.",
          completed_at: charge.completed_at,
        }, 409);
      }
    }

    // Reaproveita QR AbacatePay ainda pendente. QR de outro provedor (Treeal) é substituído.
    let replacedProviderId: string | null = null;
    let existingStatus: string | null = null;
    if (payment_split_id) {
      const { data: existingSplit } = await supabase
        .from("payment_splits")
        .select("mp_payment_id, mp_qr_code, mp_qr_code_base64, mp_status, amount_cents, status")
        .eq("id", payment_split_id)
        .single();

      existingStatus = existingSplit?.status ?? null;
      if (existingSplit?.mp_payment_id && existingSplit?.mp_qr_code) {
        if (isAbacatePayId(existingSplit.mp_payment_id) && existingSplit.status === "pending") {
          console.log("[abacatepay-pix-create] Returning existing PIX:", existingSplit.mp_payment_id);
          return json({
            success: true,
            payment_id: existingSplit.mp_payment_id,
            qr_code: existingSplit.mp_qr_code,
            qr_code_base64: existingSplit.mp_qr_code_base64,
            status: existingSplit.mp_status,
            amount_cents: existingSplit.amount_cents,
          });
        }
        if (!isAbacatePayId(existingSplit.mp_payment_id)) {
          replacedProviderId = existingSplit.mp_payment_id;
          console.warn(`[abacatepay-pix-create] Split ${payment_split_id} tinha QR de outro provedor (${replacedProviderId}); será substituído por QR AbacatePay`);
        }
      }
    }

    const cleanDoc = payer_document.replace(/\D/g, "");
    const cleanPhone = (payer_phone || "").replace(/\D/g, "");

    // A v2 exige todos os campos de `customer` quando ele é enviado. Sem telefone válido,
    // omitimos o bloco inteiro: o QR continua pagável por qualquer pessoa.
    const hasFullCustomer = !!payer_email && (cleanPhone.length === 10 || cleanPhone.length === 11);
    const customer = hasFullCustomer
      ? { name: payer_name, taxId: cleanDoc, email: payer_email, cellphone: cleanPhone }
      : undefined;

    const payload = {
      method: "PIX",
      data: {
        amount: amount_cents,
        expiresIn: PIX_EXPIRATION_SECONDS,
        // Texto neutro: a description da charge costuma ser anotação interna do operador e o
        // pagador pode vê-la no app do banco. A API também limita a 140 chars (422 acima disso).
        description: PIX_DESCRIPTION,
        ...(customer ? { customer } : {}),
        ...(payment_split_id ? { externalId: payment_split_id } : {}),
        metadata: {
          charge_id: charge_id ?? null,
          payment_split_id: payment_split_id ?? null,
        },
      },
    };

    console.log("[abacatepay-pix-create] Criando PIX — valor:", amount_cents, "split:", payment_split_id ?? "-", "customer:", !!customer);

    const r = await abacateRequest<AbacatePixData>(config.apiKey, "POST", "/v2/transparents/create", payload);

    if (!r.ok || !r.data) {
      console.error("[abacatepay-pix-create] AbacatePay error:", r.status, r.raw.substring(0, 500));
      const message = r.status === 401
        ? "Chave da AbacatePay inválida ou inativa"
        : r.status === 403
        ? "Chave da AbacatePay sem permissão TRANSPARENT:CREATE"
        : "Erro ao criar cobrança PIX na AbacatePay";
      return json({ error: message, details: r.error }, r.status >= 400 && r.status < 600 ? r.status : 502);
    }

    const pix = r.data;
    if (!pix.brCode) {
      console.error("[abacatepay-pix-create] brCode ausente na resposta:", r.raw.substring(0, 500));
      return json({ error: "Código PIX não retornado pela AbacatePay" }, 502);
    }

    // Normaliza para base64 puro (padrão das colunas mp_*; o front adiciona o prefixo ao renderizar)
    const qrCodeBase64 = (pix.brCodeBase64 || "").replace(/^data:image\/\w+;base64,/, "");
    const pixStatus = pix.status || "PENDING";
    const expiresAt = pix.expiresAt ??
      new Date(Date.now() + PIX_EXPIRATION_SECONDS * 1000).toISOString();

    if (pix.devMode) {
      console.warn("[abacatepay-pix-create] ATENÇÃO: chave em Dev Mode — este PIX é simulado e não cobra de verdade");
    }

    if (payment_split_id) {
      const update: Record<string, unknown> = {
        mp_payment_id: pix.id,
        mp_qr_code: pix.brCode,
        mp_qr_code_base64: qrCodeBase64,
        mp_status: pixStatus,
        mp_ticket_url: pix.receiptUrl ?? null,
        mp_date_of_expiration: expiresAt,
      };
      // Rastreabilidade: se um QR Treeal foi substituído, guarda o txid antigo
      if (replacedProviderId) {
        update.mp_status_detail = `substituiu QR Treeal ${replacedProviderId}`;
      }
      // QR anterior expirou (split failed): com QR novo o split volta a pendente, senão o cron
      // de sync não o acompanha e o painel segue mostrando "expirado"
      if (existingStatus === "failed") {
        update.status = "pending";
        update.pix_paid_at = null;
      }

      const { error: updateError } = await supabase
        .from("payment_splits")
        .update(update)
        .eq("id", payment_split_id);

      if (updateError) {
        console.error("[abacatepay-pix-create] Error updating payment_split:", updateError);
      }
    }

    return json({
      success: true,
      payment_id: pix.id,
      qr_code: pix.brCode,
      qr_code_base64: qrCodeBase64,
      ticket_url: pix.receiptUrl ?? undefined,
      status: pixStatus,
      expiration: expiresAt,
      amount_cents,
      dev_mode: pix.devMode === true,
    });
  } catch (error) {
    console.error("[abacatepay-pix-create] Error:", error);
    return json({ error: "Erro interno ao criar pagamento PIX", details: String(error) }, 500);
  }
});
