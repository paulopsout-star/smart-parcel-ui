import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    console.log('[public-payment-link] Requisição recebida');
    console.log('[public-payment-link] ID solicitado:', id);

    if (!id) {
      console.log('[public-payment-link] ID não fornecido');
      return new Response(JSON.stringify({ error: 'ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with service role key for database access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[public-payment-link] Buscando payment_link no DB...');

    // Try to find payment link by id first, then by charge_id
    let paymentLink = null;
    let linkError = null;

    // First attempt: search by payment_link.id
    const { data: linkById, error: errorById } = await supabase
      .from('payment_links')
      .select(`
        *,
        charges!payment_links_charge_id_fkey (
          has_boleto_link,
          boleto_linha_digitavel,
          creditor_document,
          creditor_name,
          payment_method
        )
      `)
      .eq('id', id)
      .eq('status', 'active')
      .maybeSingle();

    console.log('[public-payment-link] Busca por ID:', {
      found: !!linkById,
      error: errorById?.message
    });

    if (linkById) {
      paymentLink = linkById;
    } else {
      // Second attempt: search by charge_id (for PIX links that use charge ID)
      console.log('[public-payment-link] Tentando buscar por charge_id...');
      
      const { data: linkByChargeId, error: errorByChargeId } = await supabase
        .from('payment_links')
        .select(`
          *,
          charges!payment_links_charge_id_fkey (
            has_boleto_link,
            boleto_linha_digitavel,
            creditor_document,
            creditor_name,
            payment_method
          )
        `)
        .eq('charge_id', id)
        .eq('status', 'active')
        .maybeSingle();

      console.log('[public-payment-link] Busca por charge_id:', {
        found: !!linkByChargeId,
        error: errorByChargeId?.message
      });

      paymentLink = linkByChargeId;
      linkError = errorByChargeId;
    }

    console.log('[public-payment-link] Resultado final:', {
      found: !!paymentLink,
      error: linkError?.message,
      amount: paymentLink?.amount
    });

    if (linkError || !paymentLink) {
      console.log('[public-payment-link] Payment link não encontrado ou inativo');
      return new Response(JSON.stringify({ error: 'Payment link not found or inactive' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract charge data (if joined)
    const chargeData = Array.isArray(paymentLink.charges) ? paymentLink.charges[0] : paymentLink.charges;
    
    // Return checkout data including payer information for form pre-fill
    const checkoutData = {
      id: paymentLink.id,
      charge_id: paymentLink.charge_id || paymentLink.order_id,
      title: paymentLink.description || 'Pagamento',
      description: paymentLink.description || '',
      amount_cents: paymentLink.amount,
      payer_name: paymentLink.payer_name || 'Cliente',
      payer_email: paymentLink.payer_email || '',
      payer_document: paymentLink.payer_document || '',
      payer_phone: paymentLink.payer_phone_number || '',
      has_boleto_link: chargeData?.has_boleto_link || false,
      boleto_linha_digitavel: chargeData?.boleto_linha_digitavel || '',
      creditor_document: chargeData?.creditor_document || '',
      creditor_name: chargeData?.creditor_name || '',
      payment_method: chargeData?.payment_method || null,
      order_type: paymentLink.order_type || 'credit_card'
    };

    console.log('[public-payment-link] Retornando checkout data:', {
      id: checkoutData.id,
      amount_cents: checkoutData.amount_cents,
      has_charge_id: !!checkoutData.charge_id
    });

    return new Response(JSON.stringify(checkoutData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in public-payment-link function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});