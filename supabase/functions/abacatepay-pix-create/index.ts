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
    const { chargeId, amountCents, payerEmail, payerName, payerPhone, description } = await req.json();

    console.log('[abacatepay-pix-create] Iniciando criação de cobrança PIX:', {
      chargeId,
      amountCents,
      payerEmail,
      payerPhone
    });

    // Validate required fields
    if (!chargeId || !amountCents || !payerEmail || !payerPhone) {
      return new Response(
        JSON.stringify({ 
          error: 'Campos obrigatórios: chargeId, amountCents, payerEmail, payerPhone' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados da cobrança no DB
    const { data: charge, error: chargeError } = await supabase
      .from('charges')
      .select('*')
      .eq('id', chargeId)
      .single();

    if (chargeError || !charge) {
      console.error('[abacatepay-pix-create] Cobrança não encontrada:', chargeError);
      return new Response(
        JSON.stringify({ error: 'Cobrança não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar payload para Abacate Pay API
    const baseUrl = Deno.env.get('BASE_URL') || supabaseUrl.replace('.supabase.co', '.lovable.app');
    
    const abacatePayload = {
      frequency: "ONE_TIME", // Campo obrigatório - pagamento único
      methods: ["PIX"], // Métodos de pagamento aceitos
      products: [
        {
          externalId: chargeId,
          name: description || `Cobrança ${payerName}`,
          description: description || `Pagamento para ${payerName}`,
          quantity: 1,
          price: amountCents
        }
      ],
      returnUrl: `${baseUrl}/checkout-pix/${chargeId}`,
      completionUrl: `${baseUrl}/thank-you`,
      customer: {
        name: payerName,
        email: payerEmail,
        cellphone: payerPhone
      }
    };

    console.log('[abacatepay-pix-create] Chamando Abacate Pay API...');

    // Chamar API do Abacate Pay
    const abacateResponse = await fetch('https://api.abacatepay.com/v1/billing/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${abacateApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(abacatePayload)
    });

    if (!abacateResponse.ok) {
      const errorText = await abacateResponse.text();
      console.error('[abacatepay-pix-create] Erro na API Abacate Pay:', {
        status: abacateResponse.status,
        error: errorText
      });
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar cobrança no Abacate Pay',
          details: errorText 
        }),
        { status: abacateResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const abacateData = await abacateResponse.json();
    
    console.log('[abacatepay-pix-create] Cobrança PIX criada com sucesso:', {
      billingId: abacateData.id,
      checkoutUrl: abacateData.url
    });

    // Atualizar cobrança no DB com dados do Abacate Pay
    const { error: updateError } = await supabase
      .from('charges')
      .update({
        checkout_url: abacateData.url,
        checkout_link_id: abacateData.id,
        metadata: {
          ...charge.metadata,
          pix_billing_id: abacateData.id,
          abacate_pay_data: {
            created_at: new Date().toISOString(),
            billing_id: abacateData.id,
            checkout_url: abacateData.url
          }
        }
      })
      .eq('id', chargeId);

    if (updateError) {
      console.error('[abacatepay-pix-create] Erro ao atualizar cobrança:', updateError);
    }

    // Retornar dados para o frontend
    return new Response(
      JSON.stringify({
        success: true,
        billingId: abacateData.id,
        checkoutUrl: abacateData.url,
        // Abacate Pay não retorna QR Code diretamente na criação
        // O QR Code será gerado na página de checkout
        message: 'Cobrança PIX criada com sucesso'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[abacatepay-pix-create] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
