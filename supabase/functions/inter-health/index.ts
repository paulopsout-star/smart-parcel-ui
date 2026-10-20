import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { interConfig, getInterToken, getWebhook, enderecoPadrao, INTER_SCOPES } from '../_shared/inter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Diagnóstico da integração com o Banco Inter (somente admin):
 * confere secrets, obtém token via mTLS e lê o webhook cadastrado.
 * Não emite nada.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body, null, 2), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ ok: false, error: 'Não autorizado' }, 401);
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
    if (role?.role !== 'admin') return json({ ok: false, error: 'Apenas administradores' }, 403);

    const out: Record<string, unknown> = { scopes: INTER_SCOPES, enderecoPadraoConfigurado: !!enderecoPadrao() };
    let cfg;
    try {
      cfg = interConfig();
      out.env = cfg.env;
      out.baseUrl = cfg.baseUrl;
      out.contaCorrente = cfg.contaCorrente ? 'configurada' : 'não informada';
      out.autoIssue = Deno.env.get('INTER_AUTO_ISSUE') === 'true';
    } catch (e) {
      return json({ ok: false, step: 'config', error: String(e), ...out });
    }

    try {
      const t0 = Date.now();
      const tk = await getInterToken(cfg);
      out.token = { ok: true, ms: Date.now() - t0, prefix: tk.slice(0, 8) + '…' };
    } catch (e) {
      return json({ ok: false, step: 'token', error: String(e), ...out });
    }

    try {
      out.webhook = await getWebhook(cfg);
    } catch (e) {
      out.webhook = { error: String(e) };
    }

    return json({ ok: true, ...out });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
