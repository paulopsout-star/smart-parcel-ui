import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePixRequest {
  payment_split_id?: string;
  charge_id?: string;
  amount_cents: number;
  payer_name: string;
  payer_email: string;
  payer_document: string;
  description?: string;
}

interface MercadoPagoPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  date_of_expiration: string;
  point_of_interaction: {
    transaction_data: {
      qr_code: string;
      qr_code_base64: string;
      ticket_url: string;
    };
  };
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (!mercadoPagoToken) {
      console.error("MERCADOPAGO_ACCESS_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Mercado Pago não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body: CreatePixRequest = await req.json();

    console.log("Creating PIX payment:", JSON.stringify(body, null, 2));

    const { 
      payment_split_id, 
      charge_id, 
      amount_cents, 
      payer_name, 
      payer_email, 
      payer_document,
      description 
    } = body;

    if (!amount_cents || amount_cents <= 0) {
      return new Response(
        JSON.stringify({ error: "Valor inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payer_name || !payer_email || !payer_document) {
      return new Response(
        JSON.stringify({ error: "Dados do pagador incompletos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique idempotency key
    const idempotencyKey = payment_split_id 
      ? `pix-split-${payment_split_id}` 
      : `pix-charge-${charge_id}-${Date.now()}`;

    // Check if payment already exists for this split
    if (payment_split_id) {
      const { data: existingSplit } = await supabase
        .from("payment_splits")
        .select("mp_payment_id, mp_qr_code, mp_qr_code_base64, mp_ticket_url, mp_status, amount_cents")
        .eq("id", payment_split_id)
        .single();

      if (existingSplit?.mp_payment_id && existingSplit?.mp_qr_code) {
        console.log("Returning existing PIX payment:", existingSplit.mp_payment_id);
        return new Response(
          JSON.stringify({
            success: true,
            payment_id: existingSplit.mp_payment_id,
            qr_code: existingSplit.mp_qr_code,
            qr_code_base64: existingSplit.mp_qr_code_base64,
            ticket_url: existingSplit.mp_ticket_url,
            status: existingSplit.mp_status,
            amount_cents: existingSplit.amount_cents,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Parse payer name into first and last name
    const nameParts = payer_name.trim().split(/\s+/);
    const firstName = nameParts[0] || "Cliente";
    const lastName = nameParts.slice(1).join(" ") || "Pagador";

    // Clean document (remove non-numeric chars)
    const cleanDocument = payer_document.replace(/\D/g, "");

    // Calculate expiration (24 hours from now)
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 24);
    const expirationIso = expirationDate.toISOString();

    // Create payment in Mercado Pago
    const mpPayload = {
      transaction_amount: amount_cents / 100, // Convert cents to reais
      description: description || "Pagamento via PIX - Autonegocie",
      payment_method_id: "pix",
      payer: {
        email: payer_email,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: "CPF",
          number: cleanDocument,
        },
      },
      date_of_expiration: expirationIso,
    };

    console.log("Mercado Pago payload:", JSON.stringify(mpPayload, null, 2));

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mercadoPagoToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData: MercadoPagoPaymentResponse = await mpResponse.json();

    console.log("Mercado Pago response:", JSON.stringify(mpData, null, 2));

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", mpData);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao criar pagamento PIX", 
          details: mpData 
        }),
        { status: mpResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64;
    const ticketUrl = mpData.point_of_interaction?.transaction_data?.ticket_url;

    if (!qrCode || !qrCodeBase64) {
      console.error("QR Code not found in response");
      return new Response(
        JSON.stringify({ error: "QR Code não retornado pelo Mercado Pago" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update payment_split with MP data
    if (payment_split_id) {
      const { error: updateError } = await supabase
        .from("payment_splits")
        .update({
          mp_payment_id: String(mpData.id),
          mp_qr_code: qrCode,
          mp_qr_code_base64: qrCodeBase64,
          mp_ticket_url: ticketUrl,
          mp_status: mpData.status,
          mp_status_detail: mpData.status_detail,
          mp_date_of_expiration: mpData.date_of_expiration,
        })
        .eq("id", payment_split_id);

      if (updateError) {
        console.error("Error updating payment_split:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: String(mpData.id),
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        ticket_url: ticketUrl,
        status: mpData.status,
        status_detail: mpData.status_detail,
        expiration: mpData.date_of_expiration,
        amount_cents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating PIX payment:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao criar pagamento PIX", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
