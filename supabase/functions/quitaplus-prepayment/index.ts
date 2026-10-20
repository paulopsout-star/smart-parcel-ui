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
  /** Portador do cartão informado no checkout — guardado em card_holder_details, NÃO enviado ao Quita+ (exceto o nome, como CardHolderName). */
  cardHolder?: {
    name: string;
    document: string;
    birthDate?: string | null; // YYYY-MM-DD
    phone?: string;
    email?: string;
    relationship: string;
  };
  /**
   * Legado / ConnectivityTest. Só é usado quando NÃO há chargeId nem paymentLinkId.
   * Com cobrança identificada, o pagador enviado ao Quita+ é SEMPRE o do cadastro.
   */
  payer?: {
    name: string;
    document: string;
    email: string;
    phoneNumber: string;
  };
}

interface ResolvedPayer {
  name: string;
  document: string;
  email: string;
  phoneNumber: string;
  companyId: string | null;
  chargeId: string | null;
  source: 'charge' | 'payment_link' | 'request';
}

const onlyDigits = (v: string | null | undefined) => (v || '').replace(/\D/g, '');

/**
 * Resolve o pagador a partir do CADASTRO da cobrança (charges) ou, para links avulsos
 * do admin, do payment_link. O que o cliente digita no checkout nunca entra aqui.
 * Única exceção: requisições sem chargeId/paymentLinkId (ferramenta de teste).
 */
async function resolvePayer(
  supabase: ReturnType<typeof createClient>,
  requestData: PrePaymentRequest,
): Promise<{ payer: ResolvedPayer } | { error: string }> {
  const holderPhone = onlyDigits(requestData.cardHolder?.phone);

  if (requestData.chargeId) {
    const { data: charge } = await supabase
      .from('charges')
      .select('id, company_id, payer_name, payer_document, payer_email, payer_phone')
      .eq('id', requestData.chargeId)
      .maybeSingle();

    if (charge) {
      return {
        payer: {
          name: (charge.payer_name || '').trim(),
          document: onlyDigits(charge.payer_document),
          email: (charge.payer_email || '').trim(),
          phoneNumber: onlyDigits(charge.payer_phone) || holderPhone,
          companyId: charge.company_id,
          chargeId: charge.id,
          source: 'charge',
        },
      };
    }
  }

  if (requestData.paymentLinkId) {
    const { data: link } = await supabase
      .from('payment_links')
      .select('id, company_id, charge_id, payer_name, payer_document, payer_email, payer_phone_number')
      .eq('id', requestData.paymentLinkId)
      .maybeSingle();

    if (link) {
      const phone = onlyDigits(link.payer_phone_number) || holderPhone;
      if (!onlyDigits(link.payer_phone_number) && holderPhone) {
        console.warn('[quitaplus-prepayment] payment_link sem telefone — usando celular do portador como PayerPhoneNumber');
      }
      return {
        payer: {
          name: (link.payer_name || '').trim(),
          document: onlyDigits(link.payer_document),
          email: (link.payer_email || '').trim(),
          phoneNumber: phone,
          companyId: link.company_id,
          chargeId: link.charge_id,
          source: 'payment_link',
        },
      };
    }
  }

  // Nenhuma cobrança/link encontrado (ex.: ConnectivityTest com IDs fictícios): usa o payer da requisição
  if (requestData.payer) {
    console.warn('[quitaplus-prepayment] Cobrança/link não encontrados — usando payer da requisição (modo teste)');
    return {
      payer: {
        name: (requestData.payer.name || '').trim(),
        document: onlyDigits(requestData.payer.document),
        email: (requestData.payer.email || '').trim(),
        phoneNumber: onlyDigits(requestData.payer.phoneNumber),
        companyId: null,
        chargeId: null,
        source: 'request',
      },
    };
  }

  return { error: 'Cobrança não encontrada para identificar o pagador' };
}

/** Guarda o portador informado no checkout. Falha aqui nunca interrompe o pagamento. */
async function saveCardHolder(
  supabase: ReturnType<typeof createClient>,
  requestData: PrePaymentRequest,
  payer: ResolvedPayer,
  prePaymentKey: string | null,
): Promise<void> {
  const holder = requestData.cardHolder;
  if (!holder || !payer.companyId) return;

  try {
    // O paymentLinkId da requisição nem sempre é um payment_links.id (no fluxo só-cartão,
    // /payment-direct/:id, vem o id da cobrança). Por isso o vínculo é resolvido pelo
    // split de cartão da charge, e o payment_link_id gravado é o que está no split.
    let cardSplit: { id: string; payment_link_id: string | null } | null = null;

    if (payer.chargeId) {
      const { data } = await supabase
        .from('payment_splits')
        .select('id, payment_link_id')
        .eq('charge_id', payer.chargeId)
        .eq('method', 'credit_card')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      cardSplit = data;
    }

    if (!cardSplit && requestData.paymentLinkId) {
      const { data } = await supabase
        .from('payment_splits')
        .select('id, payment_link_id')
        .eq('payment_link_id', requestData.paymentLinkId)
        .eq('method', 'credit_card')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      cardSplit = data;
    }

    const { error } = await supabase.from('card_holder_details').insert({
      company_id: payer.companyId,
      charge_id: payer.chargeId,
      payment_link_id: cardSplit?.payment_link_id ?? null,
      payment_split_id: cardSplit?.id ?? null,
      pre_payment_key: prePaymentKey,
      holder_name: (holder.name || requestData.card.holderName || '').trim(),
      holder_document: onlyDigits(holder.document),
      holder_birth_date: holder.birthDate || null,
      holder_phone: onlyDigits(holder.phone) || null,
      holder_email: (holder.email || '').trim() || null,
      relationship: holder.relationship,
    });

    if (error) {
      console.error('[quitaplus-prepayment] Erro ao salvar card_holder_details:', error);
    }
  } catch (err) {
    console.error('[quitaplus-prepayment] Exceção ao salvar card_holder_details:', err);
  }
}

/**
 * Extrai mensagem amigável da resposta da API Quita+ para exibir ao usuário
 */
function extractUserFriendlyMessage(apiResponse: string, httpStatus: number): string {
  // Mapeamento de códigos conhecidos para mensagens amigáveis
  const friendlyMessages: Record<string, string> = {
    'CARD_DECLINED': 'Cartão recusado pela operadora',
    'INSUFFICIENT_FUNDS': 'Saldo insuficiente no cartão',
    'EXPIRED_CARD': 'Cartão expirado',
    'INVALID_CVV': 'Código de segurança (CVV) inválido',
    'INVALID_CARD_NUMBER': 'Número do cartão inválido',
    'ANTIFRAUD_DECLINED': 'Transação não aprovada pelo sistema antifraude',
    'CARD_BLOCKED': 'Cartão bloqueado',
    'PROCESSING_ERROR': 'Erro ao processar pagamento. Tente novamente.',
    'INVALID_EXPIRATION_DATE': 'Data de validade do cartão inválida',
    'TRANSACTION_NOT_ALLOWED': 'Transação não permitida para este cartão',
    'CARD_NOT_SUPPORTED': 'Bandeira do cartão não suportada',
    'LIMIT_EXCEEDED': 'Limite do cartão excedido',
    'DUPLICATE_TRANSACTION': 'Transação duplicada detectada',
    'INVALID_AMOUNT': 'Valor da transação inválido',
    'TIMEOUT': 'Tempo limite excedido. Tente novamente.',
    'GENERIC_ERROR': 'Erro ao processar pagamento. Tente novamente.',
  };

  try {
    const parsed = JSON.parse(apiResponse);
    
    // Tentar extrair mensagem e código da API (vários formatos possíveis)
    const apiMessage = parsed.message || parsed.Message || 
                       parsed.errorMessage || parsed.error?.message ||
                       parsed.error_message || parsed.ErrorMessage ||
                       parsed.returnMessage || parsed.ReturnMessage;
    const apiCode = parsed.code || parsed.Code || parsed.errorCode ||
                    parsed.returnCode || parsed.ReturnCode || parsed.error?.code;
    
    // Se temos um código conhecido, usar mensagem amigável
    if (apiCode && friendlyMessages[String(apiCode).toUpperCase()]) {
      return friendlyMessages[String(apiCode).toUpperCase()];
    }
    
    // Se temos mensagem da API, retornar ela diretamente
    if (apiMessage && typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
      return apiMessage;
    }
    
    // Verificar se há campo específico de recusa de cartão
    if (parsed.authorized === false || parsed.Authorized === false) {
      const declineReason = parsed.declineReason || parsed.DeclineReason || 
                           parsed.reason || parsed.Reason;
      if (declineReason) {
        return `Cartão não autorizado: ${declineReason}`;
      }
      return 'Cartão não autorizado pela operadora';
    }
    
  } catch {
    // JSON inválido - verificar se é HTML de bloqueio WAF
    if (apiResponse.includes('Access Denied') || apiResponse.includes('errors.edgesuite.net')) {
      return 'Serviço temporariamente indisponível. Tente novamente em alguns minutos.';
    }
  }
  
  // Fallback por status HTTP
  if (httpStatus === 400) return 'Dados do cartão inválidos. Verifique e tente novamente.';
  if (httpStatus === 401) return 'Falha na autenticação. Tente novamente.';
  if (httpStatus === 403) return 'Transação não autorizada.';
  if (httpStatus === 422) return 'Dados do pagamento inválidos. Verifique e tente novamente.';
  if (httpStatus >= 500) return 'Erro temporário no servidor. Tente novamente em instantes.';
  
  return 'Não foi possível processar o pagamento. Verifique os dados e tente novamente.';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: PrePaymentRequest = await req.json();
    console.log('[quitaplus-prepayment] Iniciando pré-pagamento para charge:', requestData.chargeId);

    // Validar número de parcelas
    if (requestData.installments < 1 || requestData.installments > 21) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Número de parcelas inválido',
          message: 'O número de parcelas deve estar entre 1 e 21'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter URL do Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Pagador enviado ao Quita+ = cadastro da cobrança (nunca o formulário do checkout)
    const resolved = await resolvePayer(supabase, requestData);
    if ('error' in resolved) {
      console.error('[quitaplus-prepayment]', resolved.error, { chargeId: requestData.chargeId, paymentLinkId: requestData.paymentLinkId });
      return new Response(
        JSON.stringify({ success: false, error: 'payer_not_found', userMessage: 'Não foi possível identificar a cobrança. Atualize a página e tente novamente.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const payer = resolved.payer;
    if (!payer.name || !payer.document || !payer.email || !payer.phoneNumber) {
      console.error('[quitaplus-prepayment] Cadastro do pagador incompleto:', { source: payer.source, hasName: !!payer.name, hasDocument: !!payer.document, hasEmail: !!payer.email, hasPhone: !!payer.phoneNumber });
      return new Response(
        JSON.stringify({ success: false, error: 'payer_data_incomplete', userMessage: 'O cadastro desta cobrança está incompleto (nome, CPF/CNPJ, e-mail ou telefone). Entre em contato com quem enviou o link.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[quitaplus-prepayment] Pagador resolvido do cadastro:', { source: payer.source, chargeId: payer.chargeId, relationship: requestData.cardHolder?.relationship ?? null });

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
    const sanitizedDocument = payer.document;
    const sanitizedPhone = payer.phoneNumber;
    
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
      PayerEmail: payer.email,
      PayerPhoneNumber: sanitizedPhone,
      PayerName: payer.name,
      CardHolderName: requestData.card.holderName.trim(),
      CardNumber: sanitizedCardNumber,
      CardExpirationDate: cardExpirationDate,
      CardCvv: sanitizedCvv,
    };

    // Log do payload montado para debug
    console.log('[quitaplus-prepayment] Payload montado:', {
      AmountInCents: requestData.amount,
      Installments: requestData.installments,
      ChargeId: requestData.chargeId
    });

    // Body com apenas o cardPayload (JSON único)
    const rawBody = JSON.stringify(cardPayload);

    // Construir URL completa
    const fullUrl = `${baseUrl}/prepayment/authorize`;

    // Log detalhado do request completo (mascarando dados sensíveis)
    const maskedPayload = {
      ...cardPayload,
      CardNumber: cardPayload.CardNumber.slice(0, 6) + '******' + cardPayload.CardNumber.slice(-4),
      CardCvv: '***'
    };

    console.log('[quitaplus-prepayment] REQUEST COMPLETO:', {
      url: fullUrl,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer [MASKED]',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: maskedPayload
    });

    // Chamar API Quita+ com retry
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < 3) {
      attempts++;
      
      try {
        console.log(`[quitaplus-prepayment] Tentativa ${attempts}/3 - Chamando: ${fullUrl}`);
        
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
          body: rawBody,
        });

        const responseText = await quitaResponse.text();
        
        // Log detalhado da resposta
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

            const userMessage = extractUserFriendlyMessage(responseText, quitaResponse.status);

            return new Response(
              JSON.stringify({
                success: false,
                error: 'payment_failed',
                userMessage: userMessage,
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
        const prePaymentKey = quitaData.prePaymentKey || quitaData.pre_payment_key;

        // Extrair isApproved e message da resposta da API
        // isApproved pode vir como IsApproved (PascalCase) ou isApproved (camelCase)
        // Se não existir, assumimos false para segurança (deve existir explicitamente)
        const isApproved = quitaData.isApproved ?? quitaData.IsApproved ?? false;
        const apiMessage = quitaData.message || quitaData.Message || 
                          quitaData.returnMessage || quitaData.ReturnMessage || '';

        console.log('[quitaplus-prepayment] Resposta da API analisada:', {
          prePaymentKey: prePaymentKey ? 'presente' : 'ausente',
          isApproved,
          message: apiMessage
        });

        // VALIDAÇÃO 1: Verificar se prePaymentKey existe
        if (!prePaymentKey) {
          console.error('[quitaplus-prepayment] API retornou sucesso HTTP mas sem prePaymentKey:', responseText);
          
          const userMessage = extractUserFriendlyMessage(responseText, quitaResponse.status);

          return new Response(
            JSON.stringify({
              success: false,
              error: 'prepayment_key_missing',
              userMessage: userMessage,
              isApproved: false,
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

        // SALVAR prePaymentKey no banco MESMO se não aprovado (para rastreamento)
        // O status depende de isApproved
        const splitStatus = isApproved === true ? 'pending' : 'failed';
        
        console.log(`[quitaplus-prepayment] Salvando prePaymentKey com status: ${splitStatus}`);

        // Atualizar payment_splits com pre_payment_key
        const { error: updateError } = await supabase
          .from('payment_splits')
          .update({
            pre_payment_key: prePaymentKey,
            authorization_code: quitaData.authorizationCode || quitaData.authorization_code,
            status: splitStatus,
          })
          .eq('payment_link_id', requestData.paymentLinkId)
          .eq('method', 'credit_card');

        if (updateError) {
          console.error('[quitaplus-prepayment] Erro ao atualizar payment_splits:', updateError);
        }

        // Guardar o portador do cartão (aprovado ou não — serve para rastreabilidade)
        await saveCardHolder(supabase, requestData, payer, prePaymentKey);

        // VALIDAÇÃO 2: Verificar se isApproved === true
        // Só continua o fluxo de sucesso se aprovado
        if (isApproved !== true) {
          console.log('[quitaplus-prepayment] Pagamento NÃO aprovado pela API:', apiMessage);
          
          // Determinar mensagem amigável para o usuário
          const userMessage = apiMessage || extractUserFriendlyMessage(responseText, quitaResponse.status);
          
          // Atualizar cobrança com status failed
          await supabase
            .from('charges')
            .update({
              pre_payment_key: prePaymentKey,
              status: 'payment_denied',
            })
            .eq('id', requestData.chargeId);

          return new Response(
            JSON.stringify({
              success: false,
              error: 'payment_not_approved',
              userMessage: userMessage,
              prePaymentKey: prePaymentKey, // Retornar para referência
              isApproved: false,
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

        // Só chega aqui se prePaymentKey existe E isApproved === true
        console.log('[quitaplus-prepayment] Pré-pagamento autorizado com sucesso, prePaymentKey:', prePaymentKey);

        // Atualizar cobrança com pre_payment_key e status (somente se aprovado)
        await supabase
          .from('charges')
          .update({
            pre_payment_key: prePaymentKey,
            payment_authorized_at: new Date().toISOString(),
            status: 'pre_authorized',
          })
          .eq('id', requestData.chargeId);

        // ============================================
        // FASE 2: VÍNCULO AUTOMÁTICO DE BOLETO
        // ============================================
        console.log('[quitaplus-prepayment] Verificando se deve vincular boleto automaticamente...');

        // Buscar dados da cobrança para vínculo do boleto
        const { data: charge, error: chargeError } = await supabase
          .from('charges')
          .select('id, boleto_linha_digitavel, creditor_document, creditor_name, payment_method')
          .eq('id', requestData.chargeId)
          .single();

        if (chargeError) {
          console.error('[quitaplus-prepayment] Erro ao buscar cobrança:', chargeError);
        }

        let boletoLinked = false;
        let linkBoletoError: any = null;

        // ============================================
        // NOVA REGRA: Para pagamentos combinados (PIX + Cartão),
        // NÃO vincular boleto automaticamente.
        // O admin deve fornecer manualmente a linha digitável.
        // ============================================
        if (charge?.payment_method === 'cartao_pix') {
          console.log('[quitaplus-prepayment] Pagamento combinado (PIX + Cartão) detectado.');
          console.log('[quitaplus-prepayment] Vínculo automático de boleto DESABILITADO para este tipo de pagamento.');
          console.log('[quitaplus-prepayment] O administrador deve vincular manualmente via painel.');
          // Emissão automática no Banco Inter (boleto com o valor do cartão) — só com INTER_AUTO_ISSUE=true.
          // Roda depois da resposta (waitUntil) para não atrasar o checkout; falha não afeta o fluxo.
          if (Deno.env.get('INTER_AUTO_ISSUE') === 'true') {
            const issue = fetch(`${supabaseUrl}/functions/v1/inter-boleto-issue`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
              body: JSON.stringify({ chargeId: requestData.chargeId, source: 'prepayment' }),
            }).then(async (r) => console.log('[quitaplus-prepayment] inter-boleto-issue:', r.status, (await r.text()).slice(0, 300)))
              .catch((e) => console.error('[quitaplus-prepayment] inter-boleto-issue falhou:', e));
            // deno-lint-ignore no-explicit-any
            const rt = (globalThis as any).EdgeRuntime;
            if (rt?.waitUntil) rt.waitUntil(issue); else await issue;
          }
        } else if (charge?.boleto_linha_digitavel && prePaymentKey) {
          // Fluxo original para pagamentos APENAS cartão (não combinado)
          console.log('[quitaplus-prepayment] Pagamento apenas cartão - vinculando boleto automaticamente...', {
            chargeId: requestData.chargeId,
            linhaDigitavelLength: charge.boleto_linha_digitavel.length,
            prePaymentKey: prePaymentKey,
          });

          try {
            const linkResponse = await fetch(`${supabaseUrl}/functions/v1/quitaplus-link-boleto`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prePaymentKey: prePaymentKey,
                paymentLinkId: requestData.paymentLinkId,
                boleto: {
                  number: charge.boleto_linha_digitavel,
                  creditorDocument: charge.creditor_document || creditorDocument,
                  creditorName: charge.creditor_name || creditorName,
                }
              }),
            });

            const linkResult = await linkResponse.json();
            console.log('[quitaplus-prepayment] Resultado do vínculo de boleto:', linkResult);

            // Verificar se houve erro no vínculo
            if (linkResult.error || (linkResult.apiMetadata?.httpStatus && linkResult.apiMetadata.httpStatus >= 400)) {
              linkBoletoError = {
                message: linkResult.error || 'Erro ao vincular boleto',
                apiResponse: linkResult.apiRawResponse,
                httpStatus: linkResult.apiMetadata?.httpStatus,
                attemptedAt: new Date().toISOString(),
              };
              console.error('[quitaplus-prepayment] Erro no vínculo do boleto:', linkBoletoError);

              // Atualizar metadata com erro (não falha o fluxo)
              const { data: currentCharge } = await supabase
                .from('charges')
                .select('metadata')
                .eq('id', requestData.chargeId)
                .single();

              const updatedMetadata = {
                ...(currentCharge?.metadata as object || {}),
                link_boleto_error: linkBoletoError,
              };

              await supabase
                .from('charges')
                .update({ metadata: updatedMetadata })
                .eq('id', requestData.chargeId);

            } else {
              // Vínculo bem-sucedido
              boletoLinked = true;
              console.log('[quitaplus-prepayment] Boleto vinculado com sucesso!');

              await supabase
                .from('charges')
                .update({
                  status: 'boleto_linked',
                  boleto_linked_at: new Date().toISOString(),
                })
                .eq('id', requestData.chargeId);
            }

          } catch (linkError) {
            linkBoletoError = {
              message: linkError instanceof Error ? linkError.message : 'Erro desconhecido ao vincular boleto',
              attemptedAt: new Date().toISOString(),
            };
            console.error('[quitaplus-prepayment] Exceção ao vincular boleto:', linkError);

            // Atualizar metadata com erro
            const { data: currentCharge } = await supabase
              .from('charges')
              .select('metadata')
              .eq('id', requestData.chargeId)
              .single();

            const updatedMetadata = {
              ...(currentCharge?.metadata as object || {}),
              link_boleto_error: linkBoletoError,
            };

            await supabase
              .from('charges')
              .update({ metadata: updatedMetadata })
              .eq('id', requestData.chargeId);
          }
        } else {
          console.log('[quitaplus-prepayment] Nenhuma linha digitável encontrada, pulando vínculo de boleto');
        }

        return new Response(
          JSON.stringify({
            success: true,
            prePaymentKey: prePaymentKey,
            boletoLinked: boletoLinked,
            linkBoletoError: linkBoletoError?.message || null,
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
        error: 'internal_error',
        userMessage: 'Erro temporário. Por favor, tente novamente.',
        code: 500,
      }),
      {
        status: 200, // Sempre retorna 200 para o front-end conseguir ler o JSON
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
