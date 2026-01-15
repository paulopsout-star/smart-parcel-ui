import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações do job
const BATCH_SIZE = 50; // Máximo de registros por execução
const RATE_LIMIT_MS = 1000; // 1 segundo entre chamadas à API
const MAX_AGE_DAYS = 7; // Processar PIX dos últimos 7 dias

// Helper para delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const stats = {
    checked: 0,
    updated: 0,
    expired: 0,
    errors: 0,
    skipped: 0,
  };

  try {
    // Initialize Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Abacate Pay API Key
    const abacateApiKey = Deno.env.get('ABACATEPAY_API_KEY');
    if (!abacateApiKey) {
      throw new Error('ABACATEPAY_API_KEY não configurada');
    }

    console.log('[sync-pix-status] 🔄 Iniciando sincronização de status PIX...');

    // Calcular data limite (últimos 7 dias)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);

    // Buscar payment_splits com PIX pendente
    const { data: pendingSplits, error: queryError } = await supabase
      .from('payment_splits')
      .select(`
        id,
        charge_id,
        method,
        status,
        amount_cents,
        created_at
      `)
      .eq('method', 'pix')
      .in('status', ['pending', 'processing'])
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(BATCH_SIZE);

    if (queryError) {
      throw new Error(`Erro ao buscar splits: ${queryError.message}`);
    }

    if (!pendingSplits || pendingSplits.length === 0) {
      console.log('[sync-pix-status] ✅ Nenhum PIX pendente encontrado.');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum PIX pendente para sincronizar',
          stats,
          duration_ms: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-pix-status] 📋 Encontrados ${pendingSplits.length} PIX pendentes para verificar`);

    // Processar cada split
    for (const split of pendingSplits) {
      stats.checked++;

      try {
        // Buscar charge para obter os PIX IDs do metadata
        const { data: charge, error: chargeError } = await supabase
          .from('charges')
          .select('id, metadata, status, checkout_link_id')
          .eq('id', split.charge_id)
          .single();

        if (chargeError || !charge) {
          console.warn(`[sync-pix-status] ⚠️ Charge não encontrado para split ${split.id}`);
          stats.skipped++;
          continue;
        }

        // Obter todos os PIX IDs da cobrança
        const allPixIds = charge.metadata?.all_pix_ids || [];
        const pixIdsToCheck = allPixIds.length > 0 
          ? allPixIds 
          : [charge.checkout_link_id].filter(Boolean);

        if (pixIdsToCheck.length === 0) {
          console.warn(`[sync-pix-status] ⚠️ Nenhum PIX ID encontrado para charge ${charge.id}`);
          stats.skipped++;
          continue;
        }

        // Verificar cada PIX ID até encontrar um PAID
        let foundPaidPix = null;
        let lastStatus = 'UNKNOWN';

        for (const pixId of pixIdsToCheck) {
          console.log(`[sync-pix-status] 🔍 Verificando PIX ID: ${pixId}`);

          try {
            const abacateResponse = await fetch(
              `https://api.abacatepay.com/v1/pixQrCode/check?id=${pixId}`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${abacateApiKey}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (!abacateResponse.ok) {
              console.warn(`[sync-pix-status] ⚠️ Erro HTTP ao verificar PIX ${pixId}: ${abacateResponse.status}`);
              continue;
            }

            const abacateData = await abacateResponse.json();
            lastStatus = abacateData.data?.status || 'UNKNOWN';

            console.log(`[sync-pix-status] 📊 Status do PIX ${pixId}: ${lastStatus}`);

            // Se encontrou pagamento confirmado
            if (lastStatus === 'PAID') {
              foundPaidPix = {
                pixId,
                data: abacateData.data
              };
              console.log(`[sync-pix-status] 💰 PIX PAID encontrado: ${pixId}`);
              break;
            }

            // Rate limiting entre chamadas
            await sleep(RATE_LIMIT_MS);

          } catch (apiError) {
            console.error(`[sync-pix-status] ❌ Erro ao chamar API para PIX ${pixId}:`, apiError);
          }
        }

        // Se encontrou PIX pago, atualizar registros
        if (foundPaidPix) {
          const now = new Date().toISOString();

          // 1. Atualizar payment_split para concluded
          const { error: splitUpdateError } = await supabase
            .from('payment_splits')
            .update({
              status: 'concluded',
              pix_paid_at: now,
              processed_at: now
            })
            .eq('id', split.id);

          if (splitUpdateError) {
            console.error(`[sync-pix-status] ❌ Erro ao atualizar split ${split.id}:`, splitUpdateError);
            stats.errors++;
            continue;
          }

          console.log(`[sync-pix-status] ✅ Split ${split.id} atualizado para concluded`);

          // 2. Verificar se há outros splits pendentes para a mesma charge
          const { data: otherSplits } = await supabase
            .from('payment_splits')
            .select('id, method, status')
            .eq('charge_id', split.charge_id)
            .neq('id', split.id);

          // Calcular novo status da charge
          let newChargeStatus = 'completed';
          
          if (otherSplits && otherSplits.length > 0) {
            const hasPendingSplits = otherSplits.some(
              s => s.status === 'pending' || s.status === 'processing'
            );
            
            if (hasPendingSplits) {
              // Tem outros splits pendentes (ex: cartão ainda não pago)
              newChargeStatus = 'processing';
            }
          }

          // 3. Atualizar charge
          const chargeUpdate: Record<string, any> = {
            status: newChargeStatus,
            metadata: {
              ...charge.metadata,
              pix_paid_at: now,
              pix_status: 'PAID',
              paid_pix_id: foundPaidPix.pixId,
              sync_updated_at: now
            }
          };

          if (newChargeStatus === 'completed') {
            chargeUpdate.completed_at = now;
          }

          const { error: chargeUpdateError } = await supabase
            .from('charges')
            .update(chargeUpdate)
            .eq('id', split.charge_id);

          if (chargeUpdateError) {
            console.error(`[sync-pix-status] ❌ Erro ao atualizar charge ${split.charge_id}:`, chargeUpdateError);
          } else {
            console.log(`[sync-pix-status] ✅ Charge ${split.charge_id} atualizado para ${newChargeStatus}`);
          }

          stats.updated++;

        } else if (lastStatus === 'EXPIRED') {
          // PIX expirado - atualizar status
          const { error: expiredError } = await supabase
            .from('payment_splits')
            .update({
              status: 'failed',
              processed_at: new Date().toISOString()
            })
            .eq('id', split.id);

          if (!expiredError) {
            stats.expired++;
            console.log(`[sync-pix-status] ⏰ Split ${split.id} marcado como expirado`);
          }
        }

        // Rate limiting entre charges
        await sleep(RATE_LIMIT_MS);

      } catch (splitError) {
        console.error(`[sync-pix-status] ❌ Erro ao processar split ${split.id}:`, splitError);
        stats.errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-pix-status] ✅ Sincronização concluída em ${duration}ms:`, stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída: ${stats.updated} atualizados, ${stats.expired} expirados`,
        stats,
        duration_ms: duration
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-pix-status] ❌ Erro crítico:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stats,
        duration_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
