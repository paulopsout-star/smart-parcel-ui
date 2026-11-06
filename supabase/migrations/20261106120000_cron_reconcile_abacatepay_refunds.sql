-- Reconciliação diária de estornos AbacatePay (06/11/2026)
--
-- O webhook `transparent.refunded` era descartado quando o PIX já estava concluído, e o sync de
-- 5 min só olha PIX pendentes. Resultado: estorno feito no painel da AbacatePay não chegava à
-- plataforma (6 casos entre 15/10 e 28/10/2026). O webhook foi corrigido; este job é a rede de
-- segurança: 1x/dia reconsulta os PIX já pagos dos últimos 120 dias e marca os estornados.
--
-- Usa a mesma chave pública (anon) do job de sync — não é segredo.
-- Para desativar: select cron.unschedule('reconcile-abacatepay-refunds-daily');

select cron.schedule(
  'reconcile-abacatepay-refunds-daily',
  '15 9 * * *', -- 06:15 em Brasília
  $$
  SELECT net.http_post(
    url      := 'https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/sync-abacatepay-status',
    headers  := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYmJya2JleXhzcXFqcWhwdHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODk5NTQsImV4cCI6MjA3Mzg2NTk1NH0.I5l0SDwsAN_rsSdoZiE9GAndkn3tkqX44O5ypu0cu7w',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYmJya2JleXhzcXFqcWhwdHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODk5NTQsImV4cCI6MjA3Mzg2NTk1NH0.I5l0SDwsAN_rsSdoZiE9GAndkn3tkqX44O5ypu0cu7w'
    ),
    body     := '{"reconcile": true}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
