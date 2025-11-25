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
    if (!pixId) {
      return new Response(
        JSON.stringify({ error: 'pixId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chamar endpoint de verificação do Abacate Pay
    const abacateResponse = await fetch(`https://api.abacatepay.com/v1/pixQrCode/${pixId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${abacateApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!abacateResponse.ok) {
      const errorText = await abacateResponse.text();
      console.error('[abacatepay-check-status] ❌ Erro na API Abacate Pay:', {
        status: abacateResponse.status,
        error: errorText
      });
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao verificar status do PIX',
          details: errorText 
        }),
        { status: abacateResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const abacateData = await abacateResponse.json();
    
    console.log('[abacatepay-check-status] ✅ Status verificado:', {
      pixId,
      status: abacateData.data?.status,
      expiresAt: abacateData.data?.expiresAt
    });

    // Se o pagamento foi confirmado, atualizar a cobrança no banco
    if (abacateData.data?.status === 'PAID' && chargeId) {
      console.log('[abacatepay-check-status] 💰 Pagamento confirmado, atualizando cobrança:', chargeId);
      
      const { error: updateError } = await supabase
        .from('charges')
        .update({
          status: 'completed',
          metadata: {
            pix_paid_at: new Date().toISOString(),
            pix_status: 'PAID',
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

    // Retornar status
    return new Response(
      JSON.stringify({
        success: true,
        status: abacateData.data?.status || 'UNKNOWN',
        expiresAt: abacateData.data?.expiresAt,
        data: abacateData.data
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
