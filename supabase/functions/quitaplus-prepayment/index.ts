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

    // Validar número de parcelas
    if (requestData.installments < 1 || requestData.installments > 12) {
      return new Response(
        JSON.stringify({ 
          error: 'Número de parcelas inválido',
          message: 'O número de parcelas deve estar entre 1 e 12'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Obter credenciais do ambiente
    const merchantId = Deno.env.get('QUITA_MAIS_MERCHANT_ID') || '';
    const creditorName = Deno.env.get('QUITA_MAIS_CREDITOR_NAME') || '';
    const creditorDocument = Deno.env.get('QUITA_MAIS_CREDITOR_DOCUMENT') || '';
    const baseUrl = Deno.env.get('QUITAPLUS_BASE_URL') || '';

    // Sanitizar dados
    const sanitizedCardNumber = requestData.card.number.replace(/\D/g, '');
    const sanitizedCvv = requestData.card.cvv.replace(/\D/g, '');
    const sanitizedDocument = requestData.payer.document.replace(/\D/g, '');
    const sanitizedPhone = requestData.payer.phoneNumber.replace(/\D/g, '');
    
    // Converter data de expiração de MM/AA para YYYY/MM
    const expDateClean = requestData.card.expirationDate.replace(/\D/g, '');
    let cardExpirationDate: string;
    if (expDateClean.length === 4) {
      // Formato MMAA -> YYYY/MM
      const month = expDateClean.substring(0, 2);
      const year = expDateClean.substring(2, 4);
      cardExpirationDate = `20${year}/${month}`;
    } else {
      // Assumir formato já correto ou inválido
      cardExpirationDate = requestData.card.expirationDate;
    }

    // Calcular data de expiração (+30 dias)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiresAtFormatted = expiresAt.toISOString().replace('T', ' ').substring(0, 19);

    // Preparar primeiro JSON - Card Authorization (PascalCase)
    const cardPayload = {
      MerchantId: merchantId,
      CreditorName: creditorName,
      CreditorDocument: creditorDocument,
      AmountInCents: requestData.amount,
      Installments: requestData.installments,
      PayerDocument: sanitizedDocument,
      PayerEmail: requestData.payer.email.trim(),
      PayerPhoneNumber: sanitizedPhone,
      PayerName: requestData.payer.name.trim(),
      CardHolderName: requestData.card.holderName.trim(),
      CardNumber: sanitizedCardNumber,
      CardExpirationDate: cardExpirationDate,
      CardCvv: sanitizedCvv,
    };

    // Preparar segundo JSON - Order Details (camelCase)
    const orderPayload = {
      orderDetails: {
        merchantId: merchantId,
        initiatorKey: requestData.chargeId,
        expiresAt: expiresAtFormatted,
        description: "Pagamento com cartão",
        details: `Cobrança ${requestData.chargeId}`,
        payer: {
          document: sanitizedDocument,
          email: requestData.payer.email.trim(),
          phoneNumber: sanitizedPhone,
          name: requestData.payer.name.trim()
        },
        bankslip: {
          number: "",
          creditorDocument: creditorDocument,
          creditorName: creditorName
        },
        checkout: {
          maskFee: false,
          installments: null  // Sempre null - o campo Installments no cardPayload é suficiente
        }
      }
    };

    // Log do payload montado para debug
    console.log('[quitaplus-prepayment] Payload montado:', {
      AmountInCents: requestData.amount,
      Installments: requestData.installments,
      CheckoutInstallments: null,
      ChargeId: requestData.chargeId
    });

    // Concatenar os dois JSONs como string RAW (igual ao teste que funcionou)
    const rawBody = `${JSON.stringify(cardPayload, null, 2)}

${JSON.stringify(orderPayload, null, 2)}`;

    // Construir URL completa
    const fullUrl = `${baseUrl}/prepayment/authorize`;

    // Log detalhado do request completo (igual ao teste)
    const maskedBody = rawBody
      .replace(/"CardNumber":\s*"(\d{6})\d+(\d{4})"/g, '"CardNumber": "$1******$2"')
      .replace(/"CardCvv":\s*"\d+"/g, '"CardCvv": "***"');

    console.log('[quitaplus-prepayment] REQUEST COMPLETO:', {
      url: fullUrl,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer [MASKED]',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: maskedBody
    });

    // Chamar API Quita+ com retry
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < 3) {
      attempts++;
      
      try {
        console.log(`[quitaplus-prepayment] Tentativa ${attempts}/3 - Chamando: ${fullUrl}`);
        
        // Enviar rawBody diretamente (NÃO usar JSON.stringify)
        // Headers melhorados para passar pelo WAF Akamai
        const quitaResponse = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': baseUrl.replace(/\/+$/, ''),
            'Referer': `${baseUrl}/`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Connection': 'keep-alive',
          },
          body: rawBody, // String RAW com dois JSONs concatenados
        });

        const responseText = await quitaResponse.text();
        
        // Log detalhado da resposta (igual ao teste)
        console.log('[quitaplus-prepayment] RESPONSE COMPLETO:', {
          status: quitaResponse.status,
          statusText: quitaResponse.statusText,
          headers: Object.fromEntries(quitaResponse.headers.entries()),
          body: responseText
        });

        if (!quitaResponse.ok) {
          // Erros 4xx não devem ser retried
          if (quitaResponse.status >= 400 && quitaResponse.status < 500) {
            let errorMessage = 'Erro ao processar pagamento';
            let detailedError = responseText;
            
            // Detectar bloqueio do WAF
            const isWafBlock = responseText.includes('Access Denied') || 
                              responseText.includes('errors.edgesuite.net') ||
                              quitaResponse.status === 403;
            
            if (isWafBlock) {
              errorMessage = '🛡️ WAF/CDN Akamai bloqueando requisição';
              detailedError = `ERRO 403 - WAF Akamai bloqueou a requisição vindas do IP do Supabase Edge Functions.

SOLUÇÕES POSSÍVEIS:
1. Whitelist dos IPs do Supabase no painel do WAF da Cappta
2. Implementar proxy próprio com IP fixo
3. Contatar suporte da Cappta para liberação

DETALHES TÉCNICOS:
- Status: ${quitaResponse.status}
- Referência: ${responseText.match(/Reference[^<]+/)?.[0] || 'N/A'}
- URL Bloqueada: ${fullUrl}`;
            } else {
              try {
                const errorData = JSON.parse(responseText);
                errorMessage = errorData.message || errorMessage;
              } catch {
                errorMessage = responseText || errorMessage;
              }
            }

            return new Response(
              JSON.stringify({
                apiRawResponse: responseText,
                apiMetadata: {
                  httpStatus: quitaResponse.status,
                  httpStatusText: quitaResponse.statusText,
                  httpHeaders: Object.fromEntries(quitaResponse.headers.entries()),
                  requestUrl: fullUrl
                }
              }),
              {
                status: 200,
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
            apiRawResponse: responseText,
            apiMetadata: {
              httpStatus: quitaResponse.status,
              httpStatusText: quitaResponse.statusText,
              httpHeaders: Object.fromEntries(quitaResponse.headers.entries()),
              requestUrl: fullUrl
            }
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
        code: 500,
        message: 'Erro interno do servidor',
      }),
      {
        status: 200, // Sempre retorna 200 para o front-end conseguir ler o JSON
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
