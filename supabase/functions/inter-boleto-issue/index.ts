import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  interConfig, emitirCobranca, waitUntilIssued, cancelarCobranca, enderecoPadrao, vencimentoPadrao,
  type InterPagador,
} from '../_shared/inter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IssueRequest {
  chargeId: string;
  /** Origem da chamada, só para log/metadata */
  source?: 'admin' | 'prepayment' | 'retry';
}

/**
 * Emite um boleto no Banco Inter com o valor exato do cartão pré-autorizado e o vincula ao
 * pré-pagamento no Quita+ (mesmo efeito do vínculo manual do admin).
 *
 * Quem pode chamar: admin (JWT do usuário) ou outra edge function com a service role key
 * (quitaplus-prepayment, quando INTER_AUTO_ISSUE=true).
 *
 * Pré-condições: cobrança cartao_pix, com pre_payment_key, split de cartão em 'analyzing'
 * (Quita+ 1 Received) e sem boleto no pré-pagamento atual.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const fail = (error: string, message: string, extra: Record<string, unknown> = {}) =>
    json({ success: false, error, message, ...extra });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // ---- autorização: service role OU admin
    const bearer = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    let actor = 'service';
    if (bearer !== serviceKey) {
      const { data: { user } } = await supabase.auth.getUser(bearer);
      if (!user) return fail('Não autorizado', 'Token inválido');
      const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
      if (role?.role !== 'admin') return fail('Acesso negado', 'Apenas administradores podem emitir boleto no Inter');
      actor = user.id;
    }

    const body: IssueRequest = await req.json();
    if (!body?.chargeId) return fail('chargeId obrigatório', 'Informe a cobrança');
    const source = body.source || (actor === 'service' ? 'prepayment' : 'admin');
    console.log('[inter-boleto-issue] início', { chargeId: body.chargeId, source });

    let cfg;
    try { cfg = interConfig(); } catch (e) { return fail('inter_nao_configurado', String(e)); }

    // ---- cobrança
    const { data: charge, error: chargeError } = await supabase
      .from('charges')
      .select('id, company_id, payer_name, payer_document, payer_email, payer_phone, payment_method, status, pre_payment_key, card_amount, boleto_admin_linha_digitavel, boleto_linked_at, creditor_document, creditor_name, metadata')
      .eq('id', body.chargeId)
      .single();
    if (chargeError || !charge) return fail('Cobrança não encontrada', 'ID inválido');
    if (charge.payment_method !== 'cartao_pix') return fail('Tipo de pagamento inválido', 'Emissão automática só para PIX + Cartão');
    if (!charge.pre_payment_key) return fail('Cartão não autorizado', 'O cartão precisa estar pré-autorizado');

    const { data: cardSplit } = await supabase
      .from('payment_splits')
      .select('id, status, amount_cents, pre_payment_key')
      .eq('charge_id', charge.id)
      .eq('method', 'credit_card')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!cardSplit) return fail('Split de cartão não encontrado', 'Cobrança sem cartão ativo');
    if (cardSplit.status !== 'analyzing') {
      return fail('Etapa inválida', `O cartão precisa estar pré-autorizado (Received). Etapa atual: ${cardSplit.status}`);
    }
    const amountCents: number = cardSplit.amount_cents ?? charge.card_amount;
    if (!amountCents || amountCents < 250) return fail('Valor inválido', 'O Inter exige valor mínimo de R$ 2,50');

    // ---- idempotência: já existe cobrança Inter viva para este pré-pagamento?
    const meta = (charge.metadata && typeof charge.metadata === 'object') ? charge.metadata as Record<string, unknown> : {};
    const existing = meta.inter_cobranca as Record<string, unknown> | undefined;
    if (existing && existing.pre_payment_key === charge.pre_payment_key && existing.linhaDigitavel && existing.linked_at) {
      return fail('ja_emitido', 'Já existe boleto do Inter vinculado a este pré-pagamento', { inter_cobranca: existing });
    }

    // ---- status do pré-pagamento no Quita+ (precisa estar Received = 1 e sem boleto)
    const statusRes = await fetch(`${supabaseUrl}/functions/v1/quitaplus-prepayment-status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prePaymentKey: charge.pre_payment_key }),
    });
    const statusData = await statusRes.json();
    const statusCode = statusData?.statusCode ?? statusData?.StatusCode;
    if (statusCode !== 1) {
      return fail('Pré-pagamento inválido', `O pré-pagamento não está em Received (código ${statusCode ?? 'desconhecido'})`);
    }

    // ---- pagador
    const doc = String(charge.payer_document || '').replace(/\D/g, '');
    if (doc.length !== 11 && doc.length !== 14) return fail('Pagador inválido', 'CPF/CNPJ do pagador inválido');
    const endereco = enderecoPadrao();
    if (!endereco) return fail('inter_nao_configurado', 'Secret INTER_PAGADOR_ENDERECO ausente (a API exige endereço do pagador)');
    const phone = String(charge.payer_phone || '').replace(/\D/g, '');
    const pagador: InterPagador = {
      cpfCnpj: doc,
      tipoPessoa: doc.length === 14 ? 'JURIDICA' : 'FISICA',
      nome: String(charge.payer_name || '').trim().slice(0, 100),
      ...endereco,
      ...(charge.payer_email ? { email: String(charge.payer_email).trim().slice(0, 50) } : {}),
      ...(phone.length >= 10 ? { ddd: phone.slice(0, 2), telefone: phone.slice(2, 11) } : {}),
    };

    // ---- emitir
    // seuNumero ("Cód. de controle" no painel do Inter, máx. 15 chars) = nome da empresa da cobrança,
    // sem acentos/espaços. A referência da cobrança vai na mensagem impressa no boleto.
    const { data: company } = await supabase.from('companies').select('name').eq('id', charge.company_id).maybeSingle();
    const companyName = String(company?.name || '').trim();
    const seuNumero = companyName
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 15) || charge.id.replace(/-/g, '').slice(0, 15);
    const dataVencimento = vencimentoPadrao();
    const emitReq = {
      seuNumero,
      valorNominal: Math.round(amountCents) / 100,
      dataVencimento,
      numDiasAgenda: 0,
      pagador,
      mensagem: {
        linha1: (companyName ? `${companyName} - ` : '') + `cobranca ${charge.id.slice(0, 8)}`,
        linha2: 'Pagamento do cartao (PIX + Cartao)',
      },
    };
    console.log('[inter-boleto-issue] emitindo', { seuNumero, valorNominal: emitReq.valorNominal, dataVencimento, env: cfg.env });

    const codigoSolicitacao = await emitirCobranca(cfg, emitReq);
    const issued = await waitUntilIssued(cfg, codigoSolicitacao);
    const linha = issued.boleto?.linhaDigitavel?.replace(/\D/g, '');
    if (!linha) {
      return fail('inter_sem_linha', `Cobrança ${codigoSolicitacao} sem linha digitável (situação ${issued.cobranca?.situacao})`, { codigoSolicitacao });
    }

    const interInfo = {
      codigoSolicitacao,
      seuNumero,
      nossoNumero: issued.boleto?.nossoNumero ?? null,
      linhaDigitavel: linha,
      codigoBarras: issued.boleto?.codigoBarras ?? null,
      pixCopiaECola: issued.pix?.pixCopiaECola ?? null,
      valorCents: amountCents,
      dataVencimento,
      situacao: issued.cobranca?.situacao ?? null,
      env: cfg.env,
      issued_at: new Date().toISOString(),
      issued_by: actor,
      source,
      pre_payment_key: charge.pre_payment_key,
      linked_at: null as string | null,
      link_error: null as string | null,
    };

    // Guardar a emissão ANTES do vínculo (se o vínculo falhar, o boleto existe e pode ser reaproveitado/cancelado)
    const history = Array.isArray(meta.inter_cobrancas_history) ? meta.inter_cobrancas_history : [];
    const metaWithIssue = {
      ...meta,
      inter_cobranca: interInfo,
      inter_cobrancas_history: existing ? [...history, existing] : history,
    };
    await supabase.from('charges').update({ metadata: metaWithIssue }).eq('id', charge.id);

    // ---- vincular no Quita+
    const creditorName = Deno.env.get('QUITA_MAIS_CREDITOR_NAME') || '';
    const creditorDocument = Deno.env.get('QUITA_MAIS_CREDITOR_DOCUMENT') || '';
    const linkRes = await fetch(`${supabaseUrl}/functions/v1/quitaplus-link-boleto`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prePaymentKey: charge.pre_payment_key,
        paymentLinkId: charge.id,
        boleto: {
          number: linha,
          creditorDocument: charge.creditor_document || creditorDocument,
          creditorName: charge.creditor_name || creditorName,
        },
      }),
    });
    const linkResult = await linkRes.json();
    const linkFailed = linkResult.success === false || linkResult.error || (linkResult.apiMetadata?.httpStatus && linkResult.apiMetadata.httpStatus >= 400);
    if (linkFailed) {
      const msg = linkResult.errorMessage || linkResult.error || 'Erro ao vincular boleto na API';
      console.error('[inter-boleto-issue] vínculo falhou; cancelando boleto no Inter', msg);
      let cancelled = false;
      try { await cancelarCobranca(cfg, codigoSolicitacao, 'Falha ao vincular no Quita+'); cancelled = true; } catch (e) { console.error('[inter-boleto-issue] cancelamento falhou', e); }
      await supabase.from('charges').update({
        metadata: { ...metaWithIssue, inter_cobranca: { ...interInfo, link_error: msg, cancelled_after_link_error: cancelled } },
      }).eq('id', charge.id);
      return fail('vinculo_falhou', `Boleto emitido no Inter mas o vínculo no Quita+ falhou: ${msg}`, { codigoSolicitacao, cancelledAtInter: cancelled });
    }

    // ---- sucesso: mesma atualização do vínculo manual
    const previousLinha: string | null = charge.boleto_admin_linha_digitavel || null;
    const linksHistory = Array.isArray(meta.boleto_links_history) ? meta.boleto_links_history : [];
    const linkedAt = new Date().toISOString();
    await supabase.from('charges').update({
      boleto_admin_linha_digitavel: linha,
      status: 'boleto_linked',
      boleto_linked_at: linkedAt,
      metadata: {
        ...metaWithIssue,
        inter_cobranca: { ...interInfo, linked_at: linkedAt },
        ...(previousLinha ? {
          boleto_links_history: [...linksHistory, {
            linha: previousLinha, linked_at: charge.boleto_linked_at, replaced_at: linkedAt,
            replaced_by: linha, pre_payment_key: charge.pre_payment_key, replaced_by_user: actor, via: 'inter',
          }],
        } : {}),
      },
    }).eq('id', charge.id);

    await supabase.from('charge_executions').insert({
      charge_id: charge.id,
      company_id: charge.company_id,
      status: 'boleto_linked',
      execution_log: { source: 'inter-boleto-issue', codigoSolicitacao, linhaDigitavel: linha, valorCents: amountCents, dataVencimento, actor, trigger: source },
    });

    console.log('[inter-boleto-issue] ok', { chargeId: charge.id, codigoSolicitacao });
    return json({ success: true, codigoSolicitacao, linhaDigitavel: linha, dataVencimento, valorCents: amountCents, pixCopiaECola: interInfo.pixCopiaECola });
  } catch (e) {
    console.error('[inter-boleto-issue] erro', e);
    return json({ success: false, error: 'erro_interno', message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
