-- Criar tabela de assinaturas por empresa
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL,              -- empresa "dona" da assinatura
  owner_id         uuid NOT NULL,              -- usuário responsável/administrador local
  status           text NOT NULL CHECK (status IN ('ACTIVE','PAST_DUE','CANCELED')),
  plan_code        text NULL,                  -- stub do plano (mensal, pro, etc.)
  started_at       timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NULL,         -- fim do período atual (stub)
  grace_days       int NOT NULL DEFAULT 7,     -- período de carência
  canceled_at      timestamptz NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_subscriptions_company UNIQUE (company_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON public.subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_owner ON public.subscriptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end);

-- Habilitar RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Política para admins (podem ver e editar tudo)
CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Política para operadores (podem ver apenas suas assinaturas)
CREATE POLICY "Users can view their own subscription" ON public.subscriptions
  FOR SELECT USING (owner_id = auth.uid());

-- Função para verificar se assinatura está ativa
CREATE OR REPLACE FUNCTION public.is_subscription_active(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions 
    WHERE company_id = p_company_id 
    AND status = 'ACTIVE'
  );
$$;

-- Função para verificar se assinatura está permitida (com grace period)
CREATE OR REPLACE FUNCTION public.is_subscription_allowed(p_company_id uuid, p_now_ts timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT 
        CASE 
          WHEN status = 'ACTIVE' THEN true
          WHEN status = 'PAST_DUE' THEN 
            p_now_ts <= (COALESCE(current_period_end, started_at) + (grace_days || ' days')::interval)
          ELSE false
        END
      FROM public.subscriptions 
      WHERE company_id = p_company_id
    ),
    false -- Se não existe assinatura, retorna false
  );
$$;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.subscriptions IS 'Controle de assinaturas SaaS por empresa';
COMMENT ON COLUMN public.subscriptions.status IS 'ACTIVE: Ativa | PAST_DUE: Em atraso | CANCELED: Cancelada';
COMMENT ON COLUMN public.subscriptions.grace_days IS 'Dias de carência para uso quando PAST_DUE';
COMMENT ON COLUMN public.subscriptions.current_period_end IS 'Fim do período atual (stub para futura integração)';
COMMENT ON COLUMN public.subscriptions.plan_code IS 'Código do plano (stub para futura integração)';

-- Inserir uma assinatura padrão ativa para desenvolvimento
INSERT INTO public.subscriptions (
  company_id, 
  owner_id, 
  status, 
  plan_code, 
  current_period_end
) 
SELECT 
  gen_random_uuid(), -- company_id stub
  id, -- owner_id baseado no primeiro admin
  'ACTIVE',
  'basic-mensal',
  now() + interval '30 days'
FROM public.profiles 
WHERE role = 'admin' 
AND NOT EXISTS (SELECT 1 FROM public.subscriptions)
LIMIT 1
ON CONFLICT (company_id) DO NOTHING;