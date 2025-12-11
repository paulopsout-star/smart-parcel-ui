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
    
    console.log('[abacatepay-webhook] 📥 Webhook recebido:', {
      event: payload.event,
      pixId: payload.data?.id,
      status: payload.data?.status,
      amount: payload.data?.amount
    });

    // Validar que é um evento válido
    if (!payload.event || !payload.data?.id) {
      console.error('[abacatepay-webhook] ❌ Payload inválido:', payload);
      return new Response(
        JSON.stringify({ error: 'Payload inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { event, data } = payload;
    const pixId = data.id;

    console.log('[abacatepay-webhook] 🔍 Buscando cobrança com pix_id:', pixId);

    // Buscar cobrança pelo pix_id do Abacate Pay (salvo no checkout_link_id)
    let { data: charge, error: chargeError } = await supabase
      .from('charges')
      .select('*')
      .eq('checkout_link_id', pixId)
      .maybeSingle();

    // Se não encontrou pelo checkout_link_id, buscar no histórico (all_pix_ids)
    if (!charge) {
      console.log('[abacatepay-webhook] 🔍 Não encontrado por checkout_link_id, buscando em all_pix_ids...');
      
      const { data: charges } = await supabase
        .from('charges')
        .select('*')
        .not('metadata->all_pix_ids', 'is', null);
      
      // Buscar manualmente no array de PIX IDs
      charge = charges?.find(c => {
        const allPixIds = c.metadata?.all_pix_ids || [];
        return allPixIds.includes(pixId);
      }) || null;
      
      if (charge) {
        console.log('[abacatepay-webhook] ✅ Cobrança encontrada no histórico:', charge.id);
      }
    }

    if (!charge) {
      console.error('[abacatepay-webhook] ❌ Cobrança não encontrada para pix_id:', pixId);
      return new Response(
        JSON.stringify({ error: 'Cobrança não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[abacatepay-webhook] ✅ Cobrança encontrada:', {
      chargeId: charge.id,
      currentStatus: charge.status,
      amount: charge.amount
    });

    // Processar eventos do Abacate Pay
    let newStatus = charge.status;
    let updateData: any = {
      metadata: {
        ...charge.metadata,
        webhook_event: event,
        webhook_received_at: new Date().toISOString(),
        pix_status: data.status,
        pix_paid_at: data.paidAt || null
      }
    };

    // Mapear eventos do Abacate Pay para status da cobrança
    switch (event) {
      case 'pixQrCode.paid':
      case 'pixQrCode.completed':
        // Para pagamentos combinados (cartao_pix), não marcar como completed ainda
        // pois só o PIX foi pago, falta o cartão
        if (charge.payment_method === 'cartao_pix') {
          newStatus = 'processing'; // Manter como processing até cartão ser pago
          updateData.status = 'processing';
          console.log('[abacatepay-webhook] ✅ PIX confirmado (pagamento combinado), aguardando cartão:', charge.id);
        } else {
          newStatus = 'completed';
          updateData.status = 'completed';
          console.log('[abacatepay-webhook] ✅ Pagamento PIX confirmado para cobrança:', charge.id);
        }
        
        // IMPORTANTE: Atualizar o payment_split do PIX para 'concluded'
        const { data: pixSplits, error: pixSplitsError } = await supabase
          .from('payment_splits')
          .select('id')
          .eq('charge_id', charge.id)
          .eq('method', 'pix')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (!pixSplitsError && pixSplits && pixSplits.length > 0) {
          const pixSplitId = pixSplits[0].id;
          const { error: splitUpdateError } = await supabase
            .from('payment_splits')
            .update({ 
              status: 'concluded',
              pix_paid_at: new Date().toISOString(),
              processed_at: new Date().toISOString()
            })
            .eq('id', pixSplitId);
          
          if (splitUpdateError) {
            console.error('[abacatepay-webhook] ⚠️ Erro ao atualizar split PIX:', splitUpdateError);
          } else {
            console.log('[abacatepay-webhook] ✅ Split PIX atualizado para concluded:', pixSplitId);
          }
        }
        break;
      
      case 'pixQrCode.pending':
        newStatus = 'processing';
        updateData.status = 'processing';
        console.log('[abacatepay-webhook] ⏳ Pagamento PIX pendente para cobrança:', charge.id);
        break;
      
      case 'pixQrCode.expired':
        newStatus = 'cancelled';
        updateData.status = 'cancelled';
        updateData.metadata.expired = true;
        console.log('[abacatepay-webhook] ⏰ QR Code PIX expirado para cobrança:', charge.id);
        break;
      
      case 'pixQrCode.refunded':
        newStatus = 'cancelled';
        updateData.status = 'cancelled';
        updateData.metadata.refunded = true;
        console.log('[abacatepay-webhook] 💰 Pagamento PIX reembolsado para cobrança:', charge.id);
        break;
      
      default:
        console.log('[abacatepay-webhook] ⚠️ Evento não mapeado:', event);
    }

    // Atualizar cobrança no banco de dados
    const { error: updateError } = await supabase
      .from('charges')
      .update(updateData)
      .eq('id', charge.id);

    if (updateError) {
      console.error('[abacatepay-webhook] ❌ Erro ao atualizar cobrança:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar cobrança' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[abacatepay-webhook] ✅ Cobrança atualizada com sucesso:', {
      chargeId: charge.id,
      oldStatus: charge.status,
      newStatus: newStatus,
      event: event
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
    console.error('[abacatepay-webhook] ❌ Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
