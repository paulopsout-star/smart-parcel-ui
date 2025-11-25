import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { billingId } = await req.json();

    if (!billingId) {
      return new Response(
        JSON.stringify({ error: 'billingId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[abacatepay-pix-qrcode] Buscando QR Code para billing:', billingId);

    // Obter API key do Abacate Pay
    const apiKey = Deno.env.get('ABACATEPAY_API_KEY');
    if (!apiKey) {
      throw new Error('ABACATEPAY_API_KEY não configurada');
    }

    // Chamar API do Abacate Pay para obter dados do billing
    const abacateResponse = await fetch(`https://api.abacatepay.com/v1/billing/${billingId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!abacateResponse.ok) {
      const errorText = await abacateResponse.text();
      console.error('[abacatepay-pix-qrcode] Erro na API Abacate Pay:', errorText);
      throw new Error(`Erro ao buscar dados do PIX: ${abacateResponse.status}`);
    }

    const billingData = await abacateResponse.json();
    
    console.log('[abacatepay-pix-qrcode] Billing data recebido:', {
      id: billingData.id,
      status: billingData.status,
      hasQrCode: !!billingData.pix?.qrCode,
      hasBrCode: !!billingData.pix?.brCode
    });

    // Extrair dados do PIX
    const pixInfo = billingData.pix || billingData.payment?.pix;
    
    if (!pixInfo?.qrCode || !pixInfo?.brCode) {
      throw new Error('QR Code PIX não disponível no billing');
    }

    return new Response(
      JSON.stringify({
        qrCode: pixInfo.qrCode,
        brCode: pixInfo.brCode,
        checkoutUrl: billingData.url
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[abacatepay-pix-qrcode] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
