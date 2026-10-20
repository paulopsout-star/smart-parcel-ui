import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { interConfig, recuperarCobranca } from '../_shared/inter.ts';

/**
 * Webhook da Cobrança v3 do Banco Inter.
 * URL cadastrada no Inter: {SUPABASE_URL}/functions/v1/inter-webhook?token={INTER_WEBHOOK_TOKEN}
 *
 * O payload do Inter só identifica a cobrança; nunca confiamos nele: relemos a cobrança na API
 * e gravamos a situação em charges.metadata.inter_cobranca. O status do split de cartão continua
 * vindo do Quita+ (statusCode 9 Paid) pelos syncs já existentes.
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  const expected = Deno.env.get('INTER_WEBHOOK_TOKEN');
  const token = new URL(req.url).searchParams.get('token');
  if (expected && token !== expected) {
    console.warn('[inter-webhook] token inválido');
    return new Response('forbidden', { status: 403 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let payload: unknown;
  try { payload = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  console.log('[inter-webhook] payload', JSON.stringify(payload).slice(0, 1000));

  // O Inter envia um array de eventos (ou um objeto único)
  const events = Array.isArray(payload) ? payload : [payload];
  const codes = Array.from(new Set(events
    .map((e: any) => e?.codigoSolicitacao || e?.cobranca?.codigoSolicitacao)
    .filter((c: unknown): c is string => typeof c === 'string' && c.length > 0)));

  if (codes.length === 0) return new Response('no codes', { status: 200 });

  let cfg;
  try { cfg = interConfig(); } catch (e) { console.error('[inter-webhook]', e); return new Response('not configured', { status: 200 }); }

  for (const codigo of codes) {
    try {
      const { data: charge } = await supabase
        .from('charges')
        .select('id, company_id, metadata')
        .eq('metadata->inter_cobranca->>codigoSolicitacao', codigo)
        .maybeSingle();
      if (!charge) { console.warn('[inter-webhook] cobrança não encontrada', codigo); continue; }

      const cob = await recuperarCobranca(cfg, codigo);
      const meta = (charge.metadata || {}) as Record<string, unknown>;
      const inter = (meta.inter_cobranca || {}) as Record<string, unknown>;
      const situacao = cob.cobranca?.situacao ?? null;
      const updated = {
        ...inter,
        situacao,
        valorTotalRecebido: cob.cobranca?.valorTotalRecebido ?? null,
        dataSituacao: cob.cobranca?.dataSituacao ?? null,
        last_webhook_at: new Date().toISOString(),
        ...(situacao === 'RECEBIDO' && !inter.paid_at ? { paid_at: new Date().toISOString() } : {}),
      };
      await supabase.from('charges').update({ metadata: { ...meta, inter_cobranca: updated } }).eq('id', charge.id);
      await supabase.from('charge_executions').insert({
        charge_id: charge.id,
        company_id: charge.company_id,
        status: 'boleto_linked', // enum charge_status; a situação real do Inter vai no log
        execution_log: { source: 'inter-webhook', codigoSolicitacao: codigo, situacao, valorTotalRecebido: updated.valorTotalRecebido },
      });
      console.log('[inter-webhook] atualizado', { chargeId: charge.id, codigo, situacao });
    } catch (e) {
      console.error('[inter-webhook] erro', codigo, e);
    }
  }
  return new Response('ok', { status: 200 });
});
