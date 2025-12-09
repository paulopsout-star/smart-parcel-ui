import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrepaymentStatusRequest {
  prePaymentKey: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prePaymentKey }: PrepaymentStatusRequest = await req.json();

    if (!prePaymentKey) {
      console.error('[quitaplus-prepayment-status] prePaymentKey não fornecido');
      return new Response(
        JSON.stringify({ error: 'prePaymentKey é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[quitaplus-prepayment-status] Consultando status para:', prePaymentKey);

    // Obter token de autenticação
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: tokenData, error: tokenError } = await supabase.functions.invoke('quitaplus-token');
    
    if (tokenError || !tokenData?.accessToken) {
      console.error('[quitaplus-prepayment-status] Erro ao obter token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Falha ao obter token de autenticação', details: tokenError?.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = (Deno.env.get('QUITAPLUS_BASE_URL') || 'https://pay-gt.autonegocie.com').replace(/\/$/, '');
    const fullUrl = `${baseUrl}/prepayment/status/${prePaymentKey}`;

    console.log('[quitaplus-prepayment-status] Chamando:', fullUrl);

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    const responseText = await response.text();

    console.log('[quitaplus-prepayment-status] Resposta:', {
      status: response.status,
      body: responseText
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao consultar status',
          apiRawResponse: responseText,
          httpStatus: response.status
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[quitaplus-prepayment-status] Erro ao parsear resposta:', parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Resposta inválida da API',
          apiRawResponse: responseText
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar campos (API pode retornar camelCase ou PascalCase)
    const status = data.status || data.Status || null;
    const transactionId = data.transactionId || data.TransactionId || null;
    const authorizationCode = data.authorizationCode || data.AuthorizationCode || null;

    console.log('[quitaplus-prepayment-status] Status obtido:', { status, transactionId, authorizationCode });

    return new Response(
      JSON.stringify({
        success: true,
        prePaymentKey,
        status,
        transactionId,
        authorizationCode,
        apiRawResponse: responseText
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[quitaplus-prepayment-status] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
