import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Abacate Pay API Key
    const abacateApiKey = Deno.env.get('ABACATEPAY_API_KEY');
    if (!abacateApiKey) {
      throw new Error('ABACATEPAY_API_KEY não configurada');
    }

    // Parse request body
    const { pixId, chargeId } = await req.json();

    console.log('[abacatepay-check-status] 🔍 Verificando status do PIX:', {
      pixId,
      chargeId
    });

    // Validar campos obrigatórios
    if (!pixId && !chargeId) {
      return new Response(
        JSON.stringify({ error: 'pixId ou chargeId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se temos chargeId, buscar TODOS os PIX IDs da cobrança
    let pixIdsToCheck = pixId ? [pixId] : [];
    
    if (chargeId) {
      const { data: charge } = await supabase
        .from('charges')
        .select('metadata, checkout_link_id')
        .eq('id', chargeId)
        .single();
      
      if (charge) {
        const allPixIds = charge.metadata?.all_pix_ids || [];
        pixIdsToCheck = allPixIds.length > 0 ? allPixIds : [charge.checkout_link_id].filter(Boolean);
        console.log('[abacatepay-check-status] 📋 Verificando múltiplos PIX IDs:', pixIdsToCheck);
      }
    }

    // Verificar cada PIX ID até encontrar um PAID
    let foundPaidPix = null;
    
    for (const checkPixId of pixIdsToCheck) {
      console.log('[abacatepay-check-status] 🔍 Verificando PIX ID:', checkPixId);
      
      const abacateResponse = await fetch(`https://api.abacatepay.com/v1/pixQrCode/check?id=${checkPixId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${abacateApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!abacateResponse.ok) {
        console.warn('[abacatepay-check-status] ⚠️ Erro ao verificar PIX:', checkPixId);
        continue;
      }

      const abacateData = await abacateResponse.json();
      
      console.log('[abacatepay-check-status] ✅ Status verificado:', {
        pixId: checkPixId,
        status: abacateData.data?.status,
        expiresAt: abacateData.data?.expiresAt
      });

      // Se encontrou um pagamento confirmado, parar a busca
      if (abacateData.data?.status === 'PAID') {
        foundPaidPix = {
          pixId: checkPixId,
          data: abacateData.data
        };
        console.log('[abacatepay-check-status] 💰 Pagamento PAID encontrado:', checkPixId);
        break;
      }
    }

    // Se encontrou pagamento confirmado, atualizar a cobrança E o payment_split
    if (foundPaidPix && chargeId) {
      console.log('[abacatepay-check-status] 💰 Atualizando cobrança e split para PIX PAID:', chargeId);
      
      // Verificar se é pagamento combinado (tem card split também)
      const { data: cardSplit } = await supabase
        .from('payment_splits')
        .select('id')
        .eq('charge_id', chargeId)
        .eq('method', 'credit_card')
        .maybeSingle();
      
      // Se tem cartão pendente, status fica 'processing', senão 'completed'
      const newChargeStatus = cardSplit ? 'processing' : 'completed';
      
      const { error: updateError } = await supabase
        .from('charges')
        .update({
          status: newChargeStatus,
          metadata: {
            pix_paid_at: new Date().toISOString(),
            pix_status: 'PAID',
            paid_pix_id: foundPaidPix.pixId,
            auto_confirmed: true
          }
        })
        .eq('id', chargeId);

      if (updateError) {
        console.error('[abacatepay-check-status] ❌ Erro ao atualizar cobrança:', updateError);
      } else {
        console.log('[abacatepay-check-status] ✅ Cobrança atualizada para', newChargeStatus);
      }
      
      // ✅ CRÍTICO: Também atualizar o payment_split do PIX para 'concluded'
      const { data: pixSplits, error: pixSplitError } = await supabase
        .from('payment_splits')
        .select('id')
        .eq('charge_id', chargeId)
        .eq('method', 'pix')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (pixSplits && pixSplits.length > 0) {
        const { error: splitUpdateError } = await supabase
          .from('payment_splits')
          .update({ 
            status: 'concluded', 
            pix_paid_at: new Date().toISOString(),
            processed_at: new Date().toISOString()
          })
          .eq('id', pixSplits[0].id);
        
        if (splitUpdateError) {
          console.error('[abacatepay-check-status] ❌ Erro ao atualizar split PIX:', splitUpdateError);
        } else {
          console.log('[abacatepay-check-status] ✅ Split PIX atualizado para concluded:', pixSplits[0].id);
        }
      } else {
        console.warn('[abacatepay-check-status] ⚠️ Nenhum split PIX encontrado para charge:', chargeId, pixSplitError);
      }
    }

    // Retornar status (do PIX pago ou do último verificado)
    const resultData = foundPaidPix || { 
      pixId: pixIdsToCheck[pixIdsToCheck.length - 1],
      data: { status: 'PENDING' }
    };
    
    return new Response(
      JSON.stringify({
        success: true,
        status: resultData.data?.status || 'UNKNOWN',
        expiresAt: resultData.data?.expiresAt,
        pixId: resultData.pixId,
        checkedCount: pixIdsToCheck.length,
        data: resultData.data
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[abacatepay-check-status] ❌ Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
