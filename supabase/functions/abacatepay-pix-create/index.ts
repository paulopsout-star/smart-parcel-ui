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
    const { chargeId, amountCents, payerEmail, payerName, payerPhone, payerDocument, description } = await req.json();

    console.log('[abacatepay-pix-create] ✅ Iniciando criação de cobrança PIX:', {
      chargeId,
      amountCents,
      payerEmail,
      hasPhone: !!payerPhone,
      hasDocument: !!payerDocument,
      documentLength: payerDocument?.length || 0
    });

    // Validate required fields
    if (!chargeId || !amountCents || !payerEmail || !payerPhone || !payerDocument) {
      console.error('[abacatepay-pix-create] ❌ Campos obrigatórios faltando:', {
        hasChargeId: !!chargeId,
        hasAmountCents: !!amountCents,
        hasPayerEmail: !!payerEmail,
        hasPayerPhone: !!payerPhone,
        hasPayerDocument: !!payerDocument
      });
      return new Response(
        JSON.stringify({ 
          error: 'Campos obrigatórios: chargeId, amountCents, payerEmail, payerPhone, payerDocument' 
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

    // Preparar dados limpos para envio
    const cleanPhone = payerPhone.replace(/\D/g, '');
    const cleanDocument = payerDocument.replace(/\D/g, '');
    
    console.log('[abacatepay-pix-create] 📋 Dados limpos:', {
      cleanPhone,
      cleanDocumentLength: cleanDocument.length,
      cleanDocumentPreview: cleanDocument.substring(0, 3) + '***'
    });
    
    // Payload correto para endpoint /v1/pixQrCode/create
    const abacatePayload = {
      amount: amountCents, // valor em centavos
      expiresIn: 3600, // 1 hora para expirar (em segundos)
      description: description || `Cobrança PIX - ${payerName}`,
      customer: {
        name: payerName,
        email: payerEmail,
        cellphone: cleanPhone,
        taxId: cleanDocument
      },
      metadata: {
        externalId: chargeId // ID da cobrança para referência
      }
    };

    console.log('[abacatepay-pix-create] 📤 Payload para endpoint /v1/pixQrCode/create (customer):', {
      name: payerName,
      email: payerEmail,
      cellphoneLength: cleanPhone.length,
      taxIdLength: cleanDocument.length
    });

    console.log('[abacatepay-pix-create] Chamando Abacate Pay API (pixQrCode/create)...');

    // Chamar endpoint correto do Abacate Pay
    const abacateResponse = await fetch('https://api.abacatepay.com/v1/pixQrCode/create', {
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
          error: 'Erro ao criar QR Code PIX no Abacate Pay',
          details: errorText 
        }),
        { status: abacateResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const abacateData = await abacateResponse.json();
    
    console.log('[abacatepay-pix-create] ✅ QR Code PIX criado com sucesso:', {
      pixId: abacateData.data?.id,
      status: abacateData.data?.status,
      expiresAt: abacateData.data?.expiresAt
    });

    // Validar resposta
    if (!abacateData.data?.brCode || !abacateData.data?.brCodeBase64) {
      console.error('[abacatepay-pix-create] Resposta incompleta:', abacateData);
      throw new Error('QR Code não retornado pela API');
    }

    // Atualizar cobrança no DB com dados do Abacate Pay
    const { error: updateError } = await supabase
      .from('charges')
      .update({
        checkout_link_id: abacateData.data.id,
        metadata: {
          ...charge.metadata,
          pix_id: abacateData.data.id,
          abacate_pay_data: {
            created_at: new Date().toISOString(),
            pix_id: abacateData.data.id,
            status: abacateData.data.status,
            expires_at: abacateData.data.expiresAt,
            qr_code_generated: true
          }
        }
      })
      .eq('id', chargeId);

    if (updateError) {
      console.error('[abacatepay-pix-create] Erro ao atualizar cobrança:', updateError);
    }

    // Retornar QR Code para o frontend
    return new Response(
      JSON.stringify({
        success: true,
        pixId: abacateData.data.id,
        brCode: abacateData.data.brCode, // Código copia-e-cola
        brCodeBase64: abacateData.data.brCodeBase64, // Imagem QR Code em base64
        status: abacateData.data.status,
        expiresAt: abacateData.data.expiresAt,
        message: 'QR Code PIX gerado com sucesso'
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
