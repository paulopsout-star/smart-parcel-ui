import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento de statusCode da API Cappta para status interno
const statusCodeMap: Record<number, string> = {
  1: "pre_authorized",       // Received
  2: "cancelled",            // Canceled
  3: "boleto_linked",        // BarcodeAssigned
  4: "processing",           // Settled
  5: "payment_denied",       // PaymentDenied
  6: "approved",             // PaymentValidated
  7: "awaiting_validation",  // AwaitingPayerValidation
  8: "validating",           // ValidatingPayment
  9: "completed",            // Paid
  50: "cnpj_nao_cadastrado", // MissingRegistryBankslipCNPJ - CNPJ não cadastrado
};

// Status considerados terminais (não devem ser re-verificados após 5 tentativas)
// Nota: "expired" não existe no enum charge_status, usando apenas valores válidos
const TERMINAL_STATUSES = ["failed", "cancelled", "payment_denied"];

// Período de verificação: últimos 90 dias
const SYNC_DAYS_WINDOW = 90;

// Máximo de tentativas de re-verificação para status terminais
const MAX_SYNC_ATTEMPTS = 5;

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

    // Calcular data limite para cobranças terminais (últimas 48h)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoISO = twoDaysAgo.toISOString();

    console.log(`[sync-payment-status] Buscando cobranças com pre_payment_key dos últimos ${SYNC_DAYS_WINDOW} dias (desde ${dateLimitISO})`);

    // Buscar cobranças ativas (não-terminais) - limitar a 25 para deixar espaço para terminais
    const { data: activeCharges, error: activeChargesError } = await supabase
      .from("charges")
      .select("id, pre_payment_key, status, company_id, payer_name, amount, boleto_linked_at, completed_at, sync_attempts")
      .not("pre_payment_key", "is", null)
      .not("status", "in", '("completed","cancelled","payment_denied","failed")')
      .gte("created_at", dateLimitISO)
      .order("created_at", { ascending: false })
      .limit(25);

    if (activeChargesError) {
      console.error("[sync-payment-status] Erro ao buscar cobranças ativas:", activeChargesError);
      throw activeChargesError;
    }

    // Buscar cobranças terminais das últimas 48h com sync_attempts < 5
    // Nota: apenas "failed" é re-verificável (cancelled/payment_denied são finais)
    const { data: terminalCharges, error: terminalChargesError } = await supabase
      .from("charges")
      .select("id, pre_payment_key, status, company_id, payer_name, amount, boleto_linked_at, completed_at, sync_attempts")
      .not("pre_payment_key", "is", null)
      .eq("status", "failed")
      .lt("sync_attempts", MAX_SYNC_ATTEMPTS)
      .gte("created_at", twoDaysAgoISO)
      .order("created_at", { ascending: false })
      .limit(10);

    if (terminalChargesError) {
      console.error("[sync-payment-status] Erro ao buscar cobranças terminais:", terminalChargesError);
      // Continuar mesmo com erro, usando apenas cobranças ativas
    }

    // Combinar listas sem duplicatas
    const allCharges = [...(activeCharges || [])];
    if (terminalCharges) {
      for (const tc of terminalCharges) {
        if (!allCharges.find(c => c.id === tc.id)) {
          allCharges.push(tc);
        }
      }
    }

    console.log(`[sync-payment-status] Total: ${allCharges.length} cobranças (${activeCharges?.length || 0} ativas + ${terminalCharges?.length || 0} terminais para re-verificar)`);

    if (allCharges.length === 0) {
      console.log("[sync-payment-status] Nenhuma cobrança com pre_payment_key encontrada no período");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhuma cobrança com cartão para sincronizar no período",
          processed: 0,
          updated: 0,
          terminal_rechecked: 0,
          duration_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CORREÇÃO: Detectar e corrigir cobranças com status inconsistente
    // (status = 'pre_authorized' mas pre_payment_key = NULL)
    const { data: inconsistentCharges } = await supabase
      .from("charges")
      .select("id, status")
      .eq("status", "pre_authorized")
      .is("pre_payment_key", null)
      .gte("created_at", dateLimitISO);

    if (inconsistentCharges && inconsistentCharges.length > 0) {
      console.log(`[sync-payment-status] ⚠️ Encontradas ${inconsistentCharges.length} cobranças com status inconsistente (pre_authorized sem pre_payment_key)`);
      
      for (const charge of inconsistentCharges) {
        const { error: fixError } = await supabase
          .from("charges")
          .update({ 
            status: "pending", 
            payment_authorized_at: null,
            updated_at: new Date().toISOString() 
          })
          .eq("id", charge.id);
        
        if (fixError) {
          console.error(`[sync-payment-status] Erro ao corrigir ${charge.id}:`, fixError);
        } else {
          console.log(`[sync-payment-status] ✅ Cobrança ${charge.id} corrigida: pre_authorized → pending`);
        }
      }
    }

    const results: Array<{
      chargeId: string;
      oldStatus: string;
      newStatus: string | null;
      apiStatusCode: number | null;
      updated: boolean;
      syncAttempts?: number;
      error?: string;
    }> = [];

    let terminalRechecked = 0;

    // Processar cada cobrança
    for (const charge of allCharges) {
      try {
        const isTerminalCharge = TERMINAL_STATUSES.includes(charge.status);
        const currentSyncAttempts = charge.sync_attempts || 0;
        
        if (isTerminalCharge) {
          terminalRechecked++;
          console.log(`[sync-payment-status] Re-verificando cobrança terminal ${charge.id} (${charge.payer_name}), tentativa ${currentSyncAttempts + 1}/${MAX_SYNC_ATTEMPTS}`);
        } else {
          console.log(`[sync-payment-status] Verificando charge ${charge.id} (${charge.payer_name})`);
        }

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
            syncAttempts: currentSyncAttempts,
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
          // STATUS MUDOU - atualizar e resetar contador
          const updateData: Record<string, unknown> = {
            status: newStatus,
            sync_attempts: 0, // RESET contador quando status muda
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
              syncAttempts: currentSyncAttempts,
              error: updateError.message,
            });
          } else {
            console.log(`[sync-payment-status] ✅ Charge ${charge.id} atualizado: ${charge.status} → ${newStatus} (sync_attempts resetado)`);

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
                sync_attempts_before: currentSyncAttempts,
                sync_attempts_after: 0,
              },
            });

            results.push({
              chargeId: charge.id,
              oldStatus: charge.status,
              newStatus,
              apiStatusCode,
              updated: true,
              syncAttempts: 0,
            });
          }
        } else {
          // STATUS NÃO MUDOU - incrementar contador SE for terminal
          if (isTerminalCharge) {
            const newSyncAttempts = currentSyncAttempts + 1;
            
            const { error: incError } = await supabase
              .from("charges")
              .update({ 
                sync_attempts: newSyncAttempts,
                updated_at: new Date().toISOString()
              })
              .eq("id", charge.id);
            
            if (incError) {
              console.error(`[sync-payment-status] Erro ao incrementar sync_attempts para ${charge.id}:`, incError);
            } else {
              console.log(`[sync-payment-status] Charge ${charge.id} manteve status ${charge.status}, tentativa ${newSyncAttempts}/${MAX_SYNC_ATTEMPTS}`);
              
              if (newSyncAttempts >= MAX_SYNC_ATTEMPTS) {
                console.log(`[sync-payment-status] ⚠️ Charge ${charge.id} atingiu limite de ${MAX_SYNC_ATTEMPTS} tentativas, não será mais re-verificada`);
              }
            }

            results.push({
              chargeId: charge.id,
              oldStatus: charge.status,
              newStatus,
              apiStatusCode,
              updated: false,
              syncAttempts: newSyncAttempts,
            });
          } else {
            results.push({
              chargeId: charge.id,
              oldStatus: charge.status,
              newStatus,
              apiStatusCode,
              updated: false,
              syncAttempts: currentSyncAttempts,
            });
          }
        }

        // Rate limiting: aguardar 500ms entre chamadas (reduzido para evitar timeout)
        await new Promise((resolve) => setTimeout(resolve, 500));
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

    console.log(`[sync-payment-status] Sincronização concluída: ${updatedCount}/${allCharges.length} atualizados (${terminalRechecked} terminais re-verificadas) em ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: allCharges.length,
        updated: updatedCount,
        terminal_rechecked: terminalRechecked,
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
