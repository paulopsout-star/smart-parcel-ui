-- MICRO-ENTREGA #1: Migrações Incrementais (APENAS O QUE ESTÁ FALTANDO)
-- Não alterar estruturas existentes, apenas adicionar o que não existe

-- 1) ENUMS (criar apenas se não existirem)
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('PIX', 'CARD', 'QUITA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE template_channel AS ENUM ('WHATSAPP', 'EMAIL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) ÍNDICES ESSENCIAIS (apenas os que não existem)
CREATE INDEX IF NOT EXISTS idx_message_templates_user_id ON public.message_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_charge_messages_charge_id ON public.charge_messages(charge_id);
CREATE INDEX IF NOT EXISTS idx_charge_messages_template_id ON public.charge_messages(template_id);
CREATE INDEX IF NOT EXISTS idx_payout_accounts_user_id ON public.payout_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_charge_id ON public.payment_splits(charge_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_payment_link_id ON public.payment_splits(payment_link_id);
CREATE INDEX IF NOT EXISTS idx_refund_jobs_charge_id ON public.refund_jobs(charge_id);
CREATE INDEX IF NOT EXISTS idx_refund_jobs_payment_link_id ON public.refund_jobs(payment_link_id);
CREATE INDEX IF NOT EXISTS idx_refund_jobs_scheduled_for ON public.refund_jobs(scheduled_for);

-- 3) CRIAR TABELA MOCK_EVENTS (se não existir)
CREATE TABLE IF NOT EXISTS public.mock_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL,     -- 'WHATSAPP_MOCK', 'PAYMENT_MOCK', etc.
  event_key       text NOT NULL,     -- chave idempotente
  payload         jsonb NOT NULL,
  processed_at    timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_key)
);

-- RLS para mock_events
ALTER TABLE public.mock_events ENABLE ROW LEVEL SECURITY;

-- Políticas para mock_events (apenas se a tabela foi criada agora)
DO $$ 
DECLARE
    policy_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mock_events' 
        AND policyname = 'Admins and operadores can view mock events'
    ) INTO policy_exists;
    
    IF NOT policy_exists THEN
        EXECUTE 'CREATE POLICY "Admins and operadores can view mock events" ON public.mock_events
                 FOR SELECT USING (is_admin_or_operador(auth.uid()))';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mock_events' 
        AND policyname = 'System can manage mock events'
    ) INTO policy_exists;
    
    IF NOT policy_exists THEN
        EXECUTE 'CREATE POLICY "System can manage mock events" ON public.mock_events
                 FOR ALL WITH CHECK (true)';
    END IF;
END $$;

-- Índice para mock_events
CREATE INDEX IF NOT EXISTS idx_mock_events_provider ON public.mock_events(provider);
CREATE INDEX IF NOT EXISTS idx_mock_events_event_key ON public.mock_events(event_key);