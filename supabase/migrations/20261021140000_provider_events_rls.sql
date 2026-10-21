-- provider_events: tabela sem RLS exposta pela Data API (alerta "rls_disabled_in_public").
-- Está vazia e nenhum código (front ou edge function) a consulta; só a service role deve acessá-la.
alter table public.provider_events enable row level security;
revoke all on table public.provider_events from anon, authenticated;
