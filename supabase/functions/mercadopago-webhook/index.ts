import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  action: string;
  api_version: string;
  data: {
    id: string;
  };
  date_created: string;
  id: string;
  live_mode: boolean;
  type: string;
  user_id: string;
}

interface MercadoPagoPayment {
  id: number;
  status: string;
  status_detail: string;
  date_approved: string | null;
  external_reference: string | null;
  transaction_amount: number;
}

// Map Mercado Pago status to internal status
function mapMpStatusToInternal(mpStatus: string): string {
  switch (mpStatus) {
    case "approved":
      return "concluded";
    case "pending":
    case "in_process":
      return "pending";
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "failed";
    default:
      return "pending";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Accept GET requests for webhook validation
  if (req.method === "GET") {
    console.log("Webhook validation request received");
    return new Response("OK", { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "text/plain" } 
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (!mercadoPagoToken) {
      console.error("MERCADOPAGO_ACCESS_TOKEN not configured");
      return new Response("Configuration error", { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse webhook payload
    const payload: WebhookPayload = await req.json();
    console.log("Webhook received:", JSON.stringify(payload, null, 2));

    // Only process payment notifications
    if (payload.type !== "payment") {
      console.log("Ignoring non-payment notification:", payload.type);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const paymentId = payload.data?.id;
    if (!paymentId) {
      console.error("No payment ID in webhook");
      return new Response("Missing payment ID", { status: 400, headers: corsHeaders });
    }

    // Fetch payment details from Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${mercadoPagoToken}`,
      },
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json();
      console.error("Error fetching payment:", errorData);
      return new Response("Error fetching payment", { status: 500, headers: corsHeaders });
    }

    const mpPayment: MercadoPagoPayment = await mpResponse.json();
    console.log("Payment details:", JSON.stringify({
      id: mpPayment.id,
      status: mpPayment.status,
      status_detail: mpPayment.status_detail,
      amount: mpPayment.transaction_amount,
    }, null, 2));

    // Find the payment_split by mp_payment_id
    const { data: splits, error: findError } = await supabase
      .from("payment_splits")
      .select("id, charge_id, payment_link_id, status, method")
      .eq("mp_payment_id", String(mpPayment.id))
      .limit(1);

    if (findError) {
      console.error("Error finding split:", findError);
      return new Response("Database error", { status: 500, headers: corsHeaders });
    }

    if (!splits || splits.length === 0) {
      console.log("No payment_split found for mp_payment_id:", mpPayment.id);
      // Not an error - could be a payment we didn't create
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const split = splits[0];
    console.log("Found split:", split.id, "current status:", split.status);

    const internalStatus = mapMpStatusToInternal(mpPayment.status);
    const isApproved = mpPayment.status === "approved";

    // Update the payment_split
    const updateData: Record<string, unknown> = {
      mp_status: mpPayment.status,
      mp_status_detail: mpPayment.status_detail,
      status: internalStatus,
    };

    if (isApproved) {
      updateData.pix_paid_at = mpPayment.date_approved || new Date().toISOString();
      updateData.processed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("payment_splits")
      .update(updateData)
      .eq("id", split.id);

    if (updateError) {
      console.error("Error updating split:", updateError);
      return new Response("Database update error", { status: 500, headers: corsHeaders });
    }

    console.log("Updated split", split.id, "to status:", internalStatus);

    // If PIX is approved, check if all splits are done
    if (isApproved && split.charge_id) {
      const { data: allSplits } = await supabase
        .from("payment_splits")
        .select("id, status, method")
        .eq("charge_id", split.charge_id);

      if (allSplits) {
        const allConcluded = allSplits.every(s => s.status === "concluded");
        if (allConcluded) {
          console.log("All splits concluded, updating charge status");
          await supabase
            .from("charges")
            .update({ 
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", split.charge_id);
        }
      }
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
