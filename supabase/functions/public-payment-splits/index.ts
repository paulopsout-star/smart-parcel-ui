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

  try {
    let id: string | null = null;

    // Suportar GET (query param) e POST (body)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      id = url.searchParams.get('id');
    } else if (req.method === 'POST') {
      const body = await req.json();
      id = body.id;
    }

    if (!id) {
      console.error('[public-payment-splits] Missing id parameter');
      return new Response(
        JSON.stringify({ error: 'Payment link id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[public-payment-splits] Fetching data for id: ${id}`);

    // Use service_role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Tentar buscar payment_link primeiro por ID
    let paymentLink = null;
    let chargeId = null;

    const { data: linkById } = await supabase
      .from('payment_links')
      .select(`
        *,
        charges!payment_links_charge_id_fkey (
          id,
          pix_amount,
          card_amount,
          has_boleto_link,
          boleto_linha_digitavel,
          creditor_document,
          creditor_name,
          payment_method,
          description,
          payer_name,
          payer_email,
          payer_document,
          payer_phone
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (linkById) {
      paymentLink = linkById;
      const chargeData = Array.isArray(linkById.charges) ? linkById.charges[0] : linkById.charges;
      chargeId = linkById.charge_id || chargeData?.id;
    } else {
      // Tentar buscar por charge_id
      const { data: linkByChargeId } = await supabase
        .from('payment_links')
        .select(`
          *,
          charges!payment_links_charge_id_fkey (
            id,
            pix_amount,
            card_amount,
            has_boleto_link,
            boleto_linha_digitavel,
            creditor_document,
            creditor_name,
            payment_method,
            description,
            payer_name,
            payer_email,
            payer_document,
            payer_phone
          )
        `)
        .eq('charge_id', id)
        .maybeSingle();

      if (linkByChargeId) {
        paymentLink = linkByChargeId;
        const chargeData = Array.isArray(linkByChargeId.charges) ? linkByChargeId.charges[0] : linkByChargeId.charges;
        chargeId = linkByChargeId.charge_id || chargeData?.id;
      } else {
        // Fallback: buscar diretamente na tabela charges
        const { data: chargeData } = await supabase
          .from('charges')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (chargeData) {
          chargeId = chargeData.id;
          // Criar um payment_link virtual
          paymentLink = {
            id: chargeData.id,
            charge_id: chargeData.id,
            amount: chargeData.amount,
            description: chargeData.description,
            payer_name: chargeData.payer_name,
            payer_email: chargeData.payer_email,
            payer_document: chargeData.payer_document,
            payer_phone_number: chargeData.payer_phone,
            charges: chargeData
          };
        }
      }
    }

    if (!paymentLink) {
      console.error('[public-payment-splits] Payment link not found');
      return new Response(
        JSON.stringify({ error: 'Payment link not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair dados da charge
    const chargeData = Array.isArray(paymentLink.charges) ? paymentLink.charges[0] : paymentLink.charges;

    // Buscar payment_splits por payment_link_id ou charge_id
    let paymentSplits = [];
    
    // Primeiro, tentar por payment_link_id
    const { data: splitsByLinkId } = await supabase
      .from('payment_splits')
      .select('*')
      .eq('payment_link_id', paymentLink.id)
      .order('order_index');

    if (splitsByLinkId && splitsByLinkId.length > 0) {
      paymentSplits = splitsByLinkId;
    } else if (chargeId) {
      // Fallback: buscar por charge_id
      const { data: splitsByChargeId } = await supabase
        .from('payment_splits')
        .select('*')
        .eq('charge_id', chargeId)
        .order('order_index');

      paymentSplits = splitsByChargeId || [];
    }

    console.log(`[public-payment-splits] ✅ Found payment_link and ${paymentSplits.length} splits`);

    // Formatar resposta - priorizar dados da charge sobre payment_link
    const response = {
      payment_link: {
        id: paymentLink.id,
        charge_id: chargeId,
        amount: paymentLink.amount,
        pix_amount: chargeData?.pix_amount || 0,
        card_amount: chargeData?.card_amount || 0,
        description: paymentLink.description || chargeData?.description || 'Pagamento',
        payer_name: chargeData?.payer_name || paymentLink.payer_name || '',
        payer_email: chargeData?.payer_email || paymentLink.payer_email || '',
        payer_document: chargeData?.payer_document || paymentLink.payer_document || '',
        payer_phone: chargeData?.payer_phone || paymentLink.payer_phone_number || '',
        has_boleto_link: chargeData?.has_boleto_link || false,
        boleto_linha_digitavel: chargeData?.boleto_linha_digitavel || '',
        creditor_document: chargeData?.creditor_document || '',
        creditor_name: chargeData?.creditor_name || '',
        payment_method: chargeData?.payment_method || null,
      },
      payment_splits: paymentSplits,
      // Retornar dados da charge separadamente para facilitar acesso
      charge: chargeData ? {
        id: chargeData.id,
        payer_name: chargeData.payer_name,
        payer_email: chargeData.payer_email,
        payer_document: chargeData.payer_document,
        payer_phone: chargeData.payer_phone,
      } : null,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[public-payment-splits] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
