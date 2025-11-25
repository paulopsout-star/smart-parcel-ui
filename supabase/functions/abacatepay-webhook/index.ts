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

    // Parse webhook payload
    const payload = await req.json();
    
    console.log('[abacatepay-webhook] Webhook recebido:', {
      event: payload.event,
      billingId: payload.billing?.id,
      status: payload.billing?.status
    });

    // Validar que é um evento de pagamento
    if (!payload.event || !payload.billing) {
      console.error('[abacatepay-webhook] Payload inválido:', payload);
      return new Response(
        JSON.stringify({ error: 'Payload inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { event, billing } = payload;
    const billingId = billing.id;

    // Buscar cobrança pelo billing_id do Abacate Pay
    const { data: charge, error: chargeError } = await supabase
      .from('charges')
      .select('*')
      .eq('checkout_link_id', billingId)
      .single();

    if (chargeError || !charge) {
      console.error('[abacatepay-webhook] Cobrança não encontrada para billing_id:', billingId, chargeError);
      return new Response(
        JSON.stringify({ error: 'Cobrança não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[abacatepay-webhook] Cobrança encontrada:', charge.id);

    // Processar eventos do Abacate Pay
    let newStatus = charge.status;
    let updateData: any = {
      metadata: {
        ...charge.metadata,
        webhook_event: event,
        webhook_received_at: new Date().toISOString(),
        billing_status: billing.status
      }
    };

    // Mapear eventos do Abacate Pay para status da cobrança
    switch (event) {
      case 'billing.paid':
      case 'payment.approved':
        newStatus = 'completed';
        updateData.status = 'completed';
        console.log('[abacatepay-webhook] Pagamento confirmado para cobrança:', charge.id);
        break;
      
      case 'billing.pending':
        newStatus = 'processing';
        updateData.status = 'processing';
        break;
      
      case 'billing.expired':
      case 'billing.canceled':
        newStatus = 'cancelled';
        updateData.status = 'cancelled';
        break;
      
      case 'billing.refunded':
        newStatus = 'cancelled';
        updateData.status = 'cancelled';
        updateData.metadata.refunded = true;
        break;
      
      default:
        console.log('[abacatepay-webhook] Evento não mapeado:', event);
    }

    // Atualizar cobrança no banco de dados
    const { error: updateError } = await supabase
      .from('charges')
      .update(updateData)
      .eq('id', charge.id);

    if (updateError) {
      console.error('[abacatepay-webhook] Erro ao atualizar cobrança:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar cobrança' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[abacatepay-webhook] Cobrança atualizada com sucesso:', {
      chargeId: charge.id,
      oldStatus: charge.status,
      newStatus: newStatus
    });

    // Retornar sucesso para o Abacate Pay
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Webhook processado com sucesso',
        chargeId: charge.id,
        status: newStatus
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[abacatepay-webhook] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
