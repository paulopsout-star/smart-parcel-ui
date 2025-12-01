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

    // Se encontrou pagamento confirmado, atualizar a cobrança
    if (foundPaidPix && chargeId) {
      console.log('[abacatepay-check-status] 💰 Atualizando cobrança para completed:', chargeId);
      
      const { error: updateError } = await supabase
        .from('charges')
        .update({
          status: 'completed',
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
        console.log('[abacatepay-check-status] ✅ Cobrança atualizada para completed');
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
