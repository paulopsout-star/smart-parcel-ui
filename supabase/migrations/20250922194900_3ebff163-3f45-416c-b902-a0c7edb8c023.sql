-- MICRO-ENTREGA #1: Migrações Incrementais (DB) + RLS + Seeds
-- Não alterar tabelas existentes, apenas adicionar novas estruturas

-- 1) ENUMS (criar apenas se não existirem)
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('PIX', 'CARD', 'QUITA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE template_channel AS ENUM ('WHATSAPP', 'EMAIL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) TABELAS (DDL incremental)

-- 2.1 Templates de mensagem por usuário
CREATE TABLE IF NOT EXISTS public.message_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,           -- FK para profiles.id (auth.uid())
  name             text NOT NULL,
  content          text NOT NULL,           -- texto com placeholders: {{nome}}, {{valor}}, {{link}}
  variables        jsonb DEFAULT '[]'::jsonb, -- array de variáveis disponíveis
  is_active        boolean DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 2.2 Mensagens por cobrança (snapshot e trilha)
CREATE TABLE IF NOT EXISTS public.charge_messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id             uuid NOT NULL,         -- FK para charges.id
  template_id           uuid NULL,             -- FK para message_templates.id (opcional)
  phone_number          text NOT NULL,
  content               text NOT NULL,         -- conteúdo final da mensagem
  status                text NOT NULL DEFAULT 'pending', -- pending | sent | failed
  sent_at               timestamptz NULL,
  error_details         jsonb NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- 2.3 Conta de repasse (PIX) por usuário
CREATE TABLE IF NOT EXISTS public.payout_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,         -- FK para profiles.id
  account_holder_name   text NOT NULL,
  account_holder_document text NOT NULL,
  pix_key               text NOT NULL,
  pix_key_type          text NOT NULL,         -- 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'
  is_active             boolean DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 2.4 Splits de pagamento da cobrança
CREATE TABLE IF NOT EXISTS public.payment_splits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id       uuid NULL,              -- FK charges.id (pode ser nulo para payment_links)
  payment_link_id uuid NULL,              -- FK payment_links.id 
  method          text NOT NULL,          -- PIX | CARD | QUITA
  amount_cents    integer NOT NULL,       -- valor em centavos
  status          text NOT NULL DEFAULT 'pending', -- pending | concluded | failed | refunded
  transaction_id  text NULL,              -- referência externa
  processed_at    timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 2.5 Jobs de estorno (24h + taxa 5%)
CREATE TABLE IF NOT EXISTS public.refund_jobs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id               uuid NULL,              -- FK charges.id
  payment_link_id         uuid NULL,              -- FK payment_links.id
  original_amount_cents   integer NOT NULL,       -- valor original
  refund_amount_cents     integer NOT NULL,       -- valor a ser estornado
  fee_amount_cents        integer NOT NULL DEFAULT 0, -- taxa de estorno
  reason                  text NOT NULL,
  scheduled_for           timestamptz NOT NULL,   -- agendamento do estorno
  processed_at            timestamptz NULL,
  status                  text NOT NULL DEFAULT 'pending', -- pending | processed | failed | cancelled
  error_details           jsonb NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- 3) ÍNDICES ESSENCIAIS
CREATE INDEX IF NOT EXISTS idx_message_templates_user ON public.message_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_charge_messages_charge ON public.charge_messages(charge_id);
CREATE INDEX IF NOT EXISTS idx_payout_accounts_user ON public.payout_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_charge ON public.payment_splits(charge_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_payment_link ON public.payment_splits(payment_link_id);
CREATE INDEX IF NOT EXISTS idx_refund_jobs_charge ON public.refund_jobs(charge_id);
CREATE INDEX IF NOT EXISTS idx_refund_jobs_payment_link ON public.refund_jobs(payment_link_id);
CREATE INDEX IF NOT EXISTS idx_refund_jobs_schedule ON public.refund_jobs(scheduled_for);

-- 4) RLS (Row Level Security)
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas para message_templates
CREATE POLICY "Admins can view all message templates" ON public.message_templates
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage their own message templates" ON public.message_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas para charge_messages
CREATE POLICY "Admins and operadores can view charge messages" ON public.charge_messages
  FOR SELECT USING (is_admin_or_operador(auth.uid()));

CREATE POLICY "System can insert charge messages" ON public.charge_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update charge messages" ON public.charge_messages
  FOR UPDATE USING (true);

-- Políticas para payout_accounts
CREATE POLICY "Admins can view all payout accounts" ON public.payout_accounts
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage their own payout accounts" ON public.payout_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas para payment_splits
CREATE POLICY "Admins and operadores can view payment splits" ON public.payment_splits
  FOR SELECT USING (is_admin_or_operador(auth.uid()));

CREATE POLICY "System can manage payment splits" ON public.payment_splits
  FOR ALL WITH CHECK (true);

-- Políticas para refund_jobs
CREATE POLICY "Admins and operadores can view refund jobs" ON public.refund_jobs
  FOR SELECT USING (is_admin_or_operador(auth.uid()));

CREATE POLICY "System can manage refund jobs" ON public.refund_jobs
  FOR ALL WITH CHECK (true);

-- 5) TRIGGERS PARA updated_at
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payout_accounts_updated_at
  BEFORE UPDATE ON public.payout_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();