import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkBoletoRequest {
  prePaymentKey: string;
  paymentLinkId: string;
  boleto: {
    number: string; // linha digitável
    creditorDocument: string;
    creditorName: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: LinkBoletoRequest = await req.json();
    console.log('[quitaplus-link-boleto] Iniciando vínculo de boleto para prePaymentKey:', requestData.prePaymentKey);

    // Validar linha digitável (47 ou 48 dígitos)
    const sanitizedNumber = requestData.boleto.number.replace(/\D/g, '');
    if (sanitizedNumber.length !== 47 && sanitizedNumber.length !== 48) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Linha digitável do boleto inválida',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Obter URL do Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    // Obter token de autenticação
    const tokenResponse = await fetch(`${supabaseUrl}/functions/v1/quitaplus-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Falha na autenticação: ${tokenResponse.statusText}`);
    }

    const { accessToken } = await tokenResponse.json();

    const baseUrl = Deno.env.get('QUITAPLUS_BASE_URL') || '';

    // Preparar payload para Quita+
    const quitaPlusPayload = {
      bankslip: {
        number: sanitizedNumber,
        creditorDocument: requestData.boleto.creditorDocument.replace(/\D/g, ''),
        creditorName: requestData.boleto.creditorName.trim(),
      },
    };

    console.log('[quitaplus-link-boleto] Enviando vínculo:', {
      prePaymentKey: requestData.prePaymentKey,
      boletoLastDigits: sanitizedNumber.slice(-4),
    });

    // Chamar API Quita+ com retry
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < 3) {
      attempts++;
      
      try {
        const quitaResponse = await fetch(`${baseUrl}/prepayment/AttachBankslip/${requestData.prePaymentKey}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(quitaPlusPayload),
        });

        const responseText = await quitaResponse.text();
        console.log('[quitaplus-link-boleto] Resposta Quita+:', {
          status: quitaResponse.status,
          body: responseText.substring(0, 500),
        });

        if (!quitaResponse.ok) {
          // Erros 4xx não devem ser retried
          if (quitaResponse.status >= 400 && quitaResponse.status < 500) {
            let errorMessage = 'Erro ao vincular boleto';
            try {
              const errorData = JSON.parse(responseText);
              errorMessage = errorData.message || errorMessage;
            } catch {
              errorMessage = responseText || errorMessage;
            }

            return new Response(
              JSON.stringify({
                success: false,
                error: errorMessage,
                code: quitaResponse.status,
              }),
              {
                status: quitaResponse.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          // Erros 5xx podem ser retried
          throw new Error(`HTTP ${quitaResponse.status}: ${responseText}`);
        }

        const quitaData = JSON.parse(responseText);

        // Inicializar cliente Supabase para atualizar DB
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Atualizar payment_splits com link_id
        const { error: updateError } = await supabase
          .from('payment_splits')
          .update({
            link_id: quitaData.linkId || quitaData.link_id,
            status: 'linked',
          })
          .eq('payment_link_id', requestData.paymentLinkId)
          .eq('pre_payment_key', requestData.prePaymentKey);

        if (updateError) {
          console.error('[quitaplus-link-boleto] Erro ao atualizar payment_splits:', updateError);
          throw updateError;
        }

        console.log('[quitaplus-link-boleto] Boleto vinculado com sucesso');

        return new Response(
          JSON.stringify({
            success: true,
            linkId: quitaData.linkId || quitaData.link_id,
            prePaymentKey: requestData.prePaymentKey,
            status: quitaData.status || 'LINKED',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );

      } catch (error) {
        lastError = error as Error;
        console.error(`[quitaplus-link-boleto] Tentativa ${attempts} falhou:`, error);
        
        if (attempts < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
    }

    throw lastError;

  } catch (error) {
    console.error('[quitaplus-link-boleto] Erro fatal:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
