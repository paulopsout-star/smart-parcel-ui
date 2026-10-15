-- Contingência AbacatePay (out/2026): sincroniza PIX AbacatePay pendentes a cada 5 min,
-- espelhando o job "sync-treeal-status-every-5min" (jobid 1).
--
-- Para desativar quando a Treeal normalizar:
--   select cron.unschedule('sync-abacatepay-status-every-5min');

select cron.schedule(
  'sync-abacatepay-status-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url      := 'https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/sync-abacatepay-status',
    headers  := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYmJya2JleXhzcXFqcWhwdHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODk5NTQsImV4cCI6MjA3Mzg2NTk1NH0.I5l0SDwsAN_rsSdoZiE9GAndkn3tkqX44O5ypu0cu7w',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYmJya2JleXhzcXFqcWhwdHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODk5NTQsImV4cCI6MjA3Mzg2NTk1NH0.I5l0SDwsAN_rsSdoZiE9GAndkn3tkqX44O5ypu0cu7w'
    ),
    body     := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
