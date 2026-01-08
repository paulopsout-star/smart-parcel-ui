import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminLinkBoletoRequest {
  chargeId: string;
  linhaDigitavel: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado', message: 'Token de autenticação ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair user do token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado', message: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Acesso negado', message: 'Apenas administradores podem vincular boletos manualmente' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: AdminLinkBoletoRequest = await req.json();
    console.log('[admin-link-boleto] Iniciando vinculação manual para charge:', requestData.chargeId);

    // Validar linha digitável
    const sanitizedLinha = requestData.linhaDigitavel.replace(/\D/g, '');
    if (sanitizedLinha.length < 47 || sanitizedLinha.length > 48) {
      return new Response(
        JSON.stringify({ 
          error: 'Linha digitável inválida', 
          message: 'A linha digitável deve ter 47 ou 48 dígitos' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar cobrança
    const { data: charge, error: chargeError } = await supabase
      .from('charges')
      .select('id, pre_payment_key, payment_method, creditor_document, creditor_name, status, boleto_admin_linha_digitavel')
      .eq('id', requestData.chargeId)
      .single();

    if (chargeError || !charge) {
      return new Response(
        JSON.stringify({ error: 'Cobrança não encontrada', message: 'ID inválido' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é pagamento combinado
    if (charge.payment_method !== 'cartao_pix') {
      return new Response(
        JSON.stringify({ 
          error: 'Tipo de pagamento inválido', 
          message: 'Vinculação manual só é permitida para pagamentos combinados (PIX + Cartão)' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se tem pre_payment_key (cartão aprovado)
    if (!charge.pre_payment_key) {
      return new Response(
        JSON.stringify({ 
          error: 'Cartão não aprovado', 
          message: 'O cartão precisa ser aprovado antes de vincular o boleto' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já foi vinculado
    if (charge.boleto_admin_linha_digitavel) {
      return new Response(
        JSON.stringify({ 
          error: 'Já vinculado', 
          message: 'Esta cobrança já possui um boleto vinculado manualmente' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter credenciais padrão
    const creditorName = Deno.env.get('QUITA_MAIS_CREDITOR_NAME') || '';
    const creditorDocument = Deno.env.get('QUITA_MAIS_CREDITOR_DOCUMENT') || '';

    console.log('[admin-link-boleto] Chamando quitaplus-link-boleto...');

    // Chamar função de vínculo
    const linkResponse = await fetch(`${supabaseUrl}/functions/v1/quitaplus-link-boleto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prePaymentKey: charge.pre_payment_key,
        paymentLinkId: requestData.chargeId,
        boleto: {
          number: sanitizedLinha,
          creditorDocument: charge.creditor_document || creditorDocument,
          creditorName: charge.creditor_name || creditorName,
        }
      }),
    });

    const linkResult = await linkResponse.json();
    console.log('[admin-link-boleto] Resultado do vínculo:', linkResult);

    // Verificar se houve erro
    if (linkResult.error || (linkResult.apiMetadata?.httpStatus && linkResult.apiMetadata.httpStatus >= 400)) {
      const errorMessage = linkResult.error || 'Erro ao vincular boleto na API';
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          apiResponse: linkResult.apiRawResponse,
          httpStatus: linkResult.apiMetadata?.httpStatus,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sucesso - Atualizar cobrança
    const { error: updateError } = await supabase
      .from('charges')
      .update({
        boleto_admin_linha_digitavel: sanitizedLinha,
        status: 'boleto_linked',
        boleto_linked_at: new Date().toISOString(),
      })
      .eq('id', requestData.chargeId);

    if (updateError) {
      console.error('[admin-link-boleto] Erro ao atualizar cobrança:', updateError);
    }

    console.log('[admin-link-boleto] Boleto vinculado com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Boleto vinculado com sucesso',
        linhaDigitavel: sanitizedLinha,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[admin-link-boleto] Erro fatal:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
