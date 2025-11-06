import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrePaymentRequest {
  chargeId: string;
  paymentLinkId: string;
  amount: number;
  installments: number;
  card: {
    holderName: string;
    number: string;
    expirationDate: string; // MM/AA
    cvv: string;
  };
  payer: {
    name: string;
    document: string;
    email: string;
    phoneNumber: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: PrePaymentRequest = await req.json();
    console.log('[quitaplus-prepayment] Iniciando pré-pagamento para charge:', requestData.chargeId);

    // Obter token de autenticação
    const tokenResponse = await fetch(`${req.headers.get('origin') || ''}/functions/v1/quitaplus-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!tokenResponse.ok) {
      throw new Error(`Falha na autenticação: ${tokenResponse.statusText}`);
    }

    const { accessToken } = await tokenResponse.json();

    // Obter credenciais do ambiente
    const merchantId = Deno.env.get('QUITA_MAIS_MERCHANT_ID') || '';
    const creditorName = Deno.env.get('QUITA_MAIS_CREDITOR_NAME') || '';
    const creditorDocument = Deno.env.get('QUITA_MAIS_CREDITOR_DOCUMENT') || '';
    const baseUrl = Deno.env.get('QUITAPLUS_BASE_URL') || '';

    // Sanitizar dados do cartão (remover espaços e pontuação)
    const sanitizedCard = {
      holderName: requestData.card.holderName.trim(),
      number: requestData.card.number.replace(/\D/g, ''),
      expirationDate: requestData.card.expirationDate.replace(/\D/g, ''),
      cvv: requestData.card.cvv.replace(/\D/g, ''),
    };

    const sanitizedPayer = {
      name: requestData.payer.name.trim(),
      document: requestData.payer.document.replace(/\D/g, ''),
      email: requestData.payer.email.trim(),
      phoneNumber: requestData.payer.phoneNumber.replace(/\D/g, ''),
    };

    // Preparar payload para Quita+
    const quitaPlusPayload = {
      merchantId,
      amount: requestData.amount,
      installments: requestData.installments,
      card: {
        holderName: sanitizedCard.holderName,
        number: sanitizedCard.number,
        expirationDate: sanitizedCard.expirationDate,
        cvv: sanitizedCard.cvv,
      },
      payer: sanitizedPayer,
      creditor: {
        name: creditorName,
        document: creditorDocument,
      },
    };

    // Log sanitizado (sem dados sensíveis)
    console.log('[quitaplus-prepayment] Enviando pré-pagamento:', {
      merchantId,
      amount: requestData.amount,
      installments: requestData.installments,
      cardLastFour: sanitizedCard.number.slice(-4),
      payerDocument: sanitizedPayer.document.slice(0, 3) + '***',
    });

    // Chamar API Quita+ com retry
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < 3) {
      attempts++;
      
      try {
        const quitaResponse = await fetch(`${baseUrl}/payment/prepayment`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(quitaPlusPayload),
        });

        const responseText = await quitaResponse.text();
        console.log('[quitaplus-prepayment] Resposta Quita+:', {
          status: quitaResponse.status,
          body: responseText.substring(0, 500),
        });

        if (!quitaResponse.ok) {
          // Erros 4xx não devem ser retried
          if (quitaResponse.status >= 400 && quitaResponse.status < 500) {
            let errorMessage = 'Erro ao processar pagamento';
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

        // Inicializar cliente Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Atualizar payment_splits com pre_payment_key
        const { error: updateError } = await supabase
          .from('payment_splits')
          .update({
            pre_payment_key: quitaData.prePaymentKey || quitaData.pre_payment_key,
            authorization_code: quitaData.authorizationCode || quitaData.authorization_code,
            status: 'pending',
          })
          .eq('payment_link_id', requestData.paymentLinkId)
          .eq('method', 'credit_card');

        if (updateError) {
          console.error('[quitaplus-prepayment] Erro ao atualizar payment_splits:', updateError);
          throw updateError;
        }

        console.log('[quitaplus-prepayment] Pré-pagamento autorizado com sucesso');

        return new Response(
          JSON.stringify({
            success: true,
            prePaymentKey: quitaData.prePaymentKey || quitaData.pre_payment_key,
            authorizationCode: quitaData.authorizationCode || quitaData.authorization_code,
            status: quitaData.status || 'AUTHORIZED',
            amount: quitaData.amount || requestData.amount,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );

      } catch (error) {
        lastError = error as Error;
        console.error(`[quitaplus-prepayment] Tentativa ${attempts} falhou:`, error);
        
        if (attempts < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
    }

    throw lastError;

  } catch (error) {
    console.error('[quitaplus-prepayment] Erro fatal:', error);
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
