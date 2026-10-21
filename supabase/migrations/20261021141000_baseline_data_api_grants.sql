-- Grants da Data API (PostgREST/supabase-js) para as tabelas existentes em public.
--
-- Até 30/10/2026 o Supabase concedia esses grants automaticamente ao criar a tabela, e por isso
-- nenhuma migração anterior os declara. A partir dessa data tabelas novas não recebem mais o
-- grant automático, e uma recriação do schema (supabase db reset, preview branch) deixaria
-- estas tabelas sem acesso pela API. Esta migração só repete o estado que já existe em produção.
-- A proteção real continua sendo o RLS de cada tabela.
--
-- provider_events fica fora de propósito: só a service role acessa (ver migração anterior).

do $$
declare
  t text;
begin
  foreach t in array array[
    'card_holder_details', 'charge_executions', 'charge_messages', 'charges', 'companies',
    'export_jobs', 'leads', 'message_templates', 'mock_events', 'payment_links', 'payment_splits',
    'payout_accounts', 'profiles', 'refund_jobs', 'subscriptions', 'transactions', 'user_roles'
  ] loop
    execute format('grant all on table public.%I to anon, authenticated, service_role', t);
  end loop;
end $$;

grant all on table public.provider_events to service_role;

-- Tabelas novas criadas DEPOIS desta migração precisam do próprio GRANT:
--   grant all on table public.<tabela> to authenticated, service_role;   -- + anon se o checkout público usar
