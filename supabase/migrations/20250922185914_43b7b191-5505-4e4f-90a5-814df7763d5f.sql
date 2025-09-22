-- Criar tabelas auxiliares incrementais para o sistema de cobrança

-- Templates de mensagem por usuário
CREATE TABLE public.message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  content text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Mensagens enviadas para cobranças
CREATE TABLE public.charge_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  charge_id uuid NOT NULL,
  template_id uuid,
  content text NOT NULL,
  phone_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamp with time zone,
  error_details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.charge_messages ENABLE ROW LEVEL SECURITY;

-- Contas de recebimento PIX
CREATE TABLE public.payout_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pix_key text NOT NULL,
  pix_key_type text NOT NULL CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')),
  account_holder_name text NOT NULL,
  account_holder_document text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;

-- Divisão de pagamentos
CREATE TABLE public.payment_splits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_link_id uuid,
  charge_id uuid,
  method text NOT NULL CHECK (method IN ('pix', 'credit_card')),
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  transaction_id text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.payment_splits ENABLE ROW LEVEL SECURITY;

-- Jobs de estorno automático
CREATE TABLE public.refund_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_link_id uuid,
  charge_id uuid,
  original_amount_cents integer NOT NULL,
  refund_amount_cents integer NOT NULL,
  fee_amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  reason text NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  processed_at timestamp with time zone,
  error_details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.refund_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para message_templates
CREATE POLICY "Users can manage their own message templates"
ON public.message_templates
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all message templates"
ON public.message_templates
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para charge_messages
CREATE POLICY "Admins and operadores can view charge messages"
ON public.charge_messages
FOR SELECT
USING (is_admin_or_operador(auth.uid()));

CREATE POLICY "System can insert charge messages"
ON public.charge_messages
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update charge messages"
ON public.charge_messages
FOR UPDATE
USING (true);

-- Políticas RLS para payout_accounts
CREATE POLICY "Users can manage their own payout accounts"
ON public.payout_accounts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payout accounts"
ON public.payout_accounts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para payment_splits
CREATE POLICY "Admins and operadores can view payment splits"
ON public.payment_splits
FOR SELECT
USING (is_admin_or_operador(auth.uid()));

CREATE POLICY "System can manage payment splits"
ON public.payment_splits
FOR ALL
WITH CHECK (true);

-- Políticas RLS para refund_jobs
CREATE POLICY "Admins and operadores can view refund jobs"
ON public.refund_jobs
FOR SELECT
USING (is_admin_or_operador(auth.uid()));

CREATE POLICY "System can manage refund jobs"
ON public.refund_jobs
FOR ALL
WITH CHECK (true);

-- Triggers para updated_at
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payout_accounts_updated_at
BEFORE UPDATE ON public.payout_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar colunas auxiliares nas tabelas existentes para suportar novas funcionalidades

-- Adicionar campos para boleto e template de mensagem na tabela charges
ALTER TABLE public.charges 
ADD COLUMN has_boleto boolean DEFAULT false,
ADD COLUMN boleto_barcode text,
ADD COLUMN message_template_id uuid,
ADD COLUMN message_template_snapshot jsonb;

-- Adicionar campo para conta PIX padrão no perfil do usuário
ALTER TABLE public.profiles
ADD COLUMN default_payout_account_id uuid;