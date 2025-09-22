-- Adicionar campos para orquestração de execuções recorrentes
ALTER TABLE public.charge_executions
  ADD COLUMN IF NOT EXISTS scheduled_for    timestamptz,
  ADD COLUMN IF NOT EXISTS status           text DEFAULT 'SCHEDULED',
  ADD COLUMN IF NOT EXISTS attempts         int  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error       text,
  ADD COLUMN IF NOT EXISTS payment_link_id  uuid NULL,
  ADD COLUMN IF NOT EXISTS planned_at       timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_at    timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at      timestamptz;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ce_charge      ON public.charge_executions(charge_id);
CREATE INDEX IF NOT EXISTS idx_ce_scheduled   ON public.charge_executions(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_ce_status      ON public.charge_executions(status);
CREATE INDEX IF NOT EXISTS idx_ce_paymentlink ON public.charge_executions(payment_link_id);

-- Comentários para documentação
COMMENT ON COLUMN public.charge_executions.scheduled_for IS 'Quando esta execução deve ocorrer (timezone America/Sao_Paulo)';
COMMENT ON COLUMN public.charge_executions.status IS 'SCHEDULED | READY | RUNNING | SUCCESS | FAILED | SKIPPED | CANCELED';
COMMENT ON COLUMN public.charge_executions.attempts IS 'Número de tentativas de processamento';
COMMENT ON COLUMN public.charge_executions.payment_link_id IS 'FK para payment_links quando execução vira READY';
COMMENT ON COLUMN public.charge_executions.planned_at IS 'Quando foi gerada pelo planner';
COMMENT ON COLUMN public.charge_executions.dispatched_at IS 'Quando virou READY';
COMMENT ON COLUMN public.charge_executions.finished_at IS 'Quando concluiu (SUCCESS/FAILED/SKIPPED/CANCELED)';