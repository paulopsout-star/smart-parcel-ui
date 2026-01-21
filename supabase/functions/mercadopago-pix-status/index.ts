import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatusRequest {
  payment_split_id?: string;
  mp_payment_id?: string;
}

interface MercadoPagoPayment {
  id: number;
  status: string;
  status_detail: string;
  date_approved: string | null;
  date_last_updated: string;
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (!mercadoPagoToken) {
      return new Response(
        JSON.stringify({ error: "Mercado Pago não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body: StatusRequest = await req.json();

    const { payment_split_id, mp_payment_id } = body;

    let paymentId = mp_payment_id;

    // If we have payment_split_id, fetch the mp_payment_id from DB
    if (payment_split_id && !paymentId) {
      const { data: split, error } = await supabase
        .from("payment_splits")
        .select("mp_payment_id, status, pix_paid_at")
        .eq("id", payment_split_id)
        .single();

      if (error || !split) {
        return new Response(
          JSON.stringify({ error: "Split não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If already concluded, return immediately
      if (split.status === "concluded" || split.pix_paid_at) {
        return new Response(
          JSON.stringify({
            success: true,
            status: "concluded",
            internal_status: "concluded",
            pix_paid: true,
            pix_paid_at: split.pix_paid_at,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      paymentId = split.mp_payment_id;
    }

    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: "Payment ID não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Checking status for MP payment:", paymentId);

    // Fetch status from Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${mercadoPagoToken}`,
      },
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json();
      console.error("Mercado Pago status error:", errorData);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar status", details: errorData }),
        { status: mpResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mpPayment: MercadoPagoPayment = await mpResponse.json();
    console.log("MP Payment status:", mpPayment.status, mpPayment.status_detail);

    const internalStatus = mapMpStatusToInternal(mpPayment.status);
    const isApproved = mpPayment.status === "approved";

    // Update payment_split if we have the ID
    if (payment_split_id) {
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
        .eq("id", payment_split_id);

      if (updateError) {
        console.error("Error updating split:", updateError);
      }

      // If approved, check if all splits are concluded and update charge status
      if (isApproved) {
        // Fetch the split to get charge_id
        const { data: splitData } = await supabase
          .from("payment_splits")
          .select("charge_id")
          .eq("id", payment_split_id)
          .single();

        if (splitData?.charge_id) {
          // Get all splits for this charge
          const { data: allSplits } = await supabase
            .from("payment_splits")
            .select("id, status")
            .eq("charge_id", splitData.charge_id);

          // Check if all splits are concluded
          const allConcluded = allSplits?.every(s => 
            s.id === payment_split_id ? true : s.status === "concluded"
          );

          if (allConcluded) {
            // Update charge to completed
            const { error: chargeError } = await supabase
              .from("charges")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
                metadata: {
                  pix_paid_at: mpPayment.date_approved || new Date().toISOString()
                }
              })
              .eq("id", splitData.charge_id);

            if (chargeError) {
              console.error("Error updating charge status:", chargeError);
            } else {
              console.log("Charge status updated to completed:", splitData.charge_id);
            }
          } else {
            console.log("Not all splits concluded yet, charge status not updated");
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mp_payment_id: paymentId,
        status: mpPayment.status,
        status_detail: mpPayment.status_detail,
        internal_status: internalStatus,
        pix_paid: isApproved,
        pix_paid_at: isApproved ? mpPayment.date_approved : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking PIX status:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
