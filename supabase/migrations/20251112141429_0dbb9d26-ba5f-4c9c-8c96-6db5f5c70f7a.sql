-- ============================================
-- FASE 1: ESTRUTURA DE EMPRESAS + USER_ROLES (V3 - Ordem correta)
-- ============================================

-- 1. Criar tabela companies
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Criar tabela user_roles (SEGURANÇA CRÍTICA)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 3. Adicionar company_id nas tabelas (NULLABLE para migração)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.charges 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.payment_links 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.charge_executions 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.message_templates 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.payout_accounts 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- 4. Criar empresa padrão para migração
INSERT INTO public.companies (id, name, document, email, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Empresa Padrão (Migração)',
  '00000000000000',
  'migracao@autonegocie.com',
  true
)
ON CONFLICT (document) DO NOTHING;

-- 5. Migrar dados existentes (ORDEM IMPORTA)
-- 5.1. Migrar roles de profiles para user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
WHERE id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 5.2. Vincular todos os profiles à empresa padrão
UPDATE public.profiles
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- 5.3. Vincular charges via created_by → profiles.company_id
UPDATE public.charges c
SET company_id = p.company_id
FROM public.profiles p
WHERE c.created_by = p.id AND c.company_id IS NULL;

-- 5.4. Fallback: charges órfãos (sem created_by ou created_by inválido)
UPDATE public.charges
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- 5.5. Vincular payment_links via charge_id
UPDATE public.payment_links pl
SET company_id = c.company_id
FROM public.charges c
WHERE pl.charge_id = c.id AND pl.company_id IS NULL;

-- 5.6. Fallback: payment_links órfãos
UPDATE public.payment_links
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- 5.7. Vincular charge_executions via charge_id
UPDATE public.charge_executions ce
SET company_id = c.company_id
FROM public.charges c
WHERE ce.charge_id = c.id AND ce.company_id IS NULL;

-- 5.8. Fallback: charge_executions órfãos
UPDATE public.charge_executions
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- 5.9. Vincular message_templates via user_id → profiles.company_id
UPDATE public.message_templates mt
SET company_id = p.company_id
FROM public.profiles p
WHERE mt.user_id = p.id AND mt.company_id IS NULL;

-- 5.10. Fallback: message_templates órfãos
UPDATE public.message_templates
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- 5.11. Vincular payout_accounts via user_id → profiles.company_id
UPDATE public.payout_accounts pa
SET company_id = p.company_id
FROM public.profiles p
WHERE pa.user_id = p.id AND pa.company_id IS NULL;

-- 5.12. Fallback: payout_accounts órfãos
UPDATE public.payout_accounts
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- 5.13. Todas transactions vão para empresa padrão
UPDATE public.transactions
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- 6. Criar índices (PERFORMANCE CRÍTICA)
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_charges_company_id ON public.charges(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_company_id ON public.payment_links(company_id);
CREATE INDEX IF NOT EXISTS idx_charge_executions_company_id ON public.charge_executions(company_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_company_id ON public.message_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_payout_accounts_company_id ON public.payout_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON public.transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- 7. Tornar company_id NOT NULL
ALTER TABLE public.profiles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.charges ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.payment_links ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.charge_executions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.message_templates ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.payout_accounts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN company_id SET NOT NULL;

-- 8. REMOVER POLICIES ANTIGAS PRIMEIRO (evitar dependências)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Admins can view all payout accounts" ON public.payout_accounts;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can manage their own payout accounts" ON public.payout_accounts;

-- 9. Agora pode dropar função antiga com CASCADE
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_or_operador(uuid) CASCADE;

-- 10. Criar novas funções com security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_operador(_user_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'operador')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id
$$;

-- 11. Enable RLS em companies e user_roles
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 12. RLS para companies
CREATE POLICY "Admins can manage all companies"
ON public.companies
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own company"
ON public.companies
FOR SELECT
TO authenticated
USING (id = public.get_user_company_id(auth.uid()));

-- 13. RLS para user_roles
CREATE POLICY "Admins can manage all user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 14. RLS profiles (NOVAS)
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view profiles from same company or all if admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR company_id = public.get_user_company_id(auth.uid())
);

-- 15. RLS charges (NOVAS)
DROP POLICY IF EXISTS "Admins and operadores can view all charges" ON public.charges;
DROP POLICY IF EXISTS "Admins and operadores can create charges" ON public.charges;
DROP POLICY IF EXISTS "Admins and operadores can update charges" ON public.charges;

CREATE POLICY "Users can view charges from their company"
ON public.charges
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_operador(auth.uid()) 
  AND company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Users can create charges in their company"
ON public.charges
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_or_operador(auth.uid()) 
  AND company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Users can update charges from their company"
ON public.charges
FOR UPDATE
TO authenticated
USING (
  public.is_admin_or_operador(auth.uid()) 
  AND company_id = public.get_user_company_id(auth.uid())
);

-- 16. RLS payment_links (NOVAS)
DROP POLICY IF EXISTS "Admins and operadores can view payment links" ON public.payment_links;
DROP POLICY IF EXISTS "Admins and operadores can create payment links" ON public.payment_links;

CREATE POLICY "Users can view payment links from their company"
ON public.payment_links
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_operador(auth.uid()) 
  AND company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Users can create payment links in their company"
ON public.payment_links
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_or_operador(auth.uid()) 
  AND company_id = public.get_user_company_id(auth.uid())
);

-- 17. RLS charge_executions (NOVAS)
DROP POLICY IF EXISTS "Admins and operadores can view executions" ON public.charge_executions;

CREATE POLICY "Users can view executions from their company"
ON public.charge_executions
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_operador(auth.uid()) 
  AND company_id = public.get_user_company_id(auth.uid())
);

-- 18. RLS message_templates (NOVAS)
CREATE POLICY "Users can manage templates from their company"
ON public.message_templates
FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()))
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- 19. RLS payout_accounts (NOVAS)
CREATE POLICY "Users can manage payout accounts from their company"
ON public.payout_accounts
FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()))
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- 20. RLS transactions (NOVAS)
DROP POLICY IF EXISTS "Admins and operadores can view transactions" ON public.transactions;

CREATE POLICY "Users can view transactions from their company"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_operador(auth.uid()) 
  AND company_id = public.get_user_company_id(auth.uid())
);

-- 21. Trigger para updated_at em companies
CREATE OR REPLACE FUNCTION public.update_companies_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_companies_updated_at();

-- 22. Atualizar trigger de novos usuários
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company_id)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    '00000000-0000-0000-0000-000000000001'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'operador');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();