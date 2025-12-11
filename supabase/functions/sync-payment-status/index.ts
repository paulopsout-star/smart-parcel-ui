import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento de statusCode da API Cappta para status interno
const statusCodeMap: Record<number, string> = {
  1: "pre_authorized",      // Received
  2: "cancelled",           // Canceled
  3: "boleto_linked",       // BarcodeAssigned
  4: "processing",          // Settled
  5: "payment_denied",      // PaymentDenied
  6: "approved",            // PaymentValidated
  7: "awaiting_validation", // AwaitingPayerValidation
  8: "validating",          // ValidatingPayment
  9: "completed",           // Paid
};

// Período de verificação: últimos 90 dias
const SYNC_DAYS_WINDOW = 90;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[sync-payment-status] Iniciando sincronização...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calcular data limite (últimos 90 dias)
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - SYNC_DAYS_WINDOW);
    const dateLimitISO = dateLimit.toISOString();

    console.log(`[sync-payment-status] Buscando cobranças com pre_payment_key dos últimos ${SYNC_DAYS_WINDOW} dias (desde ${dateLimitISO})`);

    // Buscar TODAS as cobranças com pre_payment_key (sem filtro de status)
    const { data: charges, error: chargesError } = await supabase
      .from("charges")
      .select("id, pre_payment_key, status, company_id, payer_name, amount")
      .not("pre_payment_key", "is", null)
      .gte("created_at", dateLimitISO)
      .order("created_at", { ascending: false })
      .limit(100);

    if (chargesError) {
      console.error("[sync-payment-status] Erro ao buscar cobranças:", chargesError);
      throw chargesError;
    }

    if (!charges || charges.length === 0) {
      console.log("[sync-payment-status] Nenhuma cobrança com pre_payment_key encontrada no período");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhuma cobrança com cartão para sincronizar no período",
          processed: 0,
          updated: 0,
          duration_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-payment-status] Encontradas ${charges.length} cobranças para verificar`);

    const results: Array<{
      chargeId: string;
      oldStatus: string;
      newStatus: string | null;
      apiStatusCode: number | null;
      updated: boolean;
      error?: string;
    }> = [];

    // Processar cada cobrança
    for (const charge of charges) {
      try {
        console.log(`[sync-payment-status] Verificando charge ${charge.id} (${charge.payer_name})`);

        // Chamar quitaplus-prepayment-status
        const statusResponse = await fetch(
          `${supabaseUrl}/functions/v1/quitaplus-prepayment-status`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ prePaymentKey: charge.pre_payment_key }),
          }
        );

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          console.error(`[sync-payment-status] Erro na API para ${charge.id}:`, errorText);
          results.push({
            chargeId: charge.id,
            oldStatus: charge.status,
            newStatus: null,
            apiStatusCode: null,
            updated: false,
            error: `API error: ${statusResponse.status}`,
          });
          continue;
        }

        const statusData = await statusResponse.json();
        const apiStatusCode = statusData.statusCode;
        const newStatus = statusCodeMap[apiStatusCode] || charge.status;

        console.log(`[sync-payment-status] Charge ${charge.id}: API status=${apiStatusCode}, interno=${newStatus}, atual=${charge.status}`);

        // Verificar se precisa atualizar
        if (newStatus !== charge.status) {
          const updateData: Record<string, unknown> = {
            status: newStatus,
            updated_at: new Date().toISOString(),
          };

          // Adicionar timestamps específicos
          if (newStatus === "boleto_linked" && !charge.boleto_linked_at) {
            updateData.boleto_linked_at = new Date().toISOString();
          }
          if (newStatus === "completed" && !charge.completed_at) {
            updateData.completed_at = new Date().toISOString();
          }

          const { error: updateError } = await supabase
            .from("charges")
            .update(updateData)
            .eq("id", charge.id);

          if (updateError) {
            console.error(`[sync-payment-status] Erro ao atualizar ${charge.id}:`, updateError);
            results.push({
              chargeId: charge.id,
              oldStatus: charge.status,
              newStatus,
              apiStatusCode,
              updated: false,
              error: updateError.message,
            });
          } else {
            console.log(`[sync-payment-status] ✅ Charge ${charge.id} atualizado: ${charge.status} → ${newStatus}`);

            // Registrar em charge_executions
            await supabase.from("charge_executions").insert({
              charge_id: charge.id,
              company_id: charge.company_id,
              status: newStatus,
              execution_log: {
                source: "sync-payment-status",
                previous_status: charge.status,
                api_status_code: apiStatusCode,
                synced_at: new Date().toISOString(),
              },
            });

            results.push({
              chargeId: charge.id,
              oldStatus: charge.status,
              newStatus,
              apiStatusCode,
              updated: true,
            });
          }
        } else {
          results.push({
            chargeId: charge.id,
            oldStatus: charge.status,
            newStatus,
            apiStatusCode,
            updated: false,
          });
        }

        // Rate limiting: aguardar 1 segundo entre chamadas
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (chargeError) {
        console.error(`[sync-payment-status] Erro ao processar ${charge.id}:`, chargeError);
        results.push({
          chargeId: charge.id,
          oldStatus: charge.status,
          newStatus: null,
          apiStatusCode: null,
          updated: false,
          error: String(chargeError),
        });
      }
    }

    const updatedCount = results.filter((r) => r.updated).length;
    const duration = Date.now() - startTime;

    console.log(`[sync-payment-status] Sincronização concluída: ${updatedCount}/${charges.length} atualizados em ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: charges.length,
        updated: updatedCount,
        duration_ms: duration,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sync-payment-status] Erro geral:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
