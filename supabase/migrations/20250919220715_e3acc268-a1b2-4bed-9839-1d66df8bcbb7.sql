-- Criar enum para roles do sistema
CREATE TYPE public.app_role AS ENUM ('admin', 'operador');

-- Criar tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'operador',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Função para verificar role do usuário (security definer para evitar recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role = _role
      AND is_active = true
  )
$$;

-- Função para verificar se é admin ou operador
CREATE OR REPLACE FUNCTION public.is_admin_or_operador(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role IN ('admin', 'operador')
      AND is_active = true
  )
$$;

-- Políticas RLS para profiles
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert profiles" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Enum para tipos de recorrência
CREATE TYPE public.recurrence_type AS ENUM (
  'pontual', 'diaria', 'semanal', 'quinzenal', 
  'mensal', 'semestral', 'anual'
);

-- Enum para status de cobrança
CREATE TYPE public.charge_status AS ENUM (
  'pending', 'processing', 'completed', 'failed', 'cancelled'
);

-- Tabela de cobranças (incluindo recorrentes)
CREATE TABLE public.charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  
  -- Dados do pagador
  payer_name TEXT NOT NULL,
  payer_email TEXT NOT NULL,
  payer_document TEXT NOT NULL,
  payer_phone TEXT NOT NULL,
  
  -- Dados da cobrança
  amount INTEGER NOT NULL, -- valor em centavos
  description TEXT,
  installments INTEGER DEFAULT 1,
  mask_fee BOOLEAN DEFAULT false,
  
  -- Recorrência
  recurrence_type recurrence_type NOT NULL DEFAULT 'pontual',
  recurrence_interval INTEGER DEFAULT 1, -- ex: a cada 2 semanas
  recurrence_end_date TIMESTAMP WITH TIME ZONE,
  next_charge_date TIMESTAMP WITH TIME ZONE,
  
  -- Status e controle
  status charge_status NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Metadados
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Habilitar RLS na tabela charges
ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

-- Políticas para charges
CREATE POLICY "Admins and operadores can view all charges" 
ON public.charges 
FOR SELECT 
TO authenticated
USING (public.is_admin_or_operador(auth.uid()));

CREATE POLICY "Admins and operadores can create charges" 
ON public.charges 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_admin_or_operador(auth.uid()));

CREATE POLICY "Admins and operadores can update charges" 
ON public.charges 
FOR UPDATE 
TO authenticated
USING (public.is_admin_or_operador(auth.uid()));

-- Tabela de execuções de cobrança (para rastrear cada tentativa)
CREATE TABLE public.charge_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id UUID NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  
  -- Dados da execução
  execution_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status charge_status NOT NULL,
  
  -- Link gerado
  payment_link_id TEXT,
  payment_link_url TEXT,
  quita_guid TEXT,
  
  -- Logs e erros
  execution_log JSONB DEFAULT '{}'::jsonb,
  error_details JSONB,
  
  -- Controle de idempotência
  idempotency_key TEXT UNIQUE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela charge_executions
ALTER TABLE public.charge_executions ENABLE ROW LEVEL SECURITY;

-- Políticas para charge_executions
CREATE POLICY "Admins and operadores can view executions" 
ON public.charge_executions 
FOR SELECT 
TO authenticated
USING (public.is_admin_or_operador(auth.uid()));

CREATE POLICY "System can insert executions" 
ON public.charge_executions 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Função para criar perfil automaticamente quando usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'operador'::app_role
  );
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Função para atualizar timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_charges_updated_at
  BEFORE UPDATE ON public.charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular próxima data de cobrança
CREATE OR REPLACE FUNCTION public.calculate_next_charge_date(
  current_date TIMESTAMP WITH TIME ZONE,
  recurrence_type recurrence_type,
  interval_value INTEGER DEFAULT 1
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
AS $$
BEGIN
  CASE recurrence_type
    WHEN 'pontual' THEN
      RETURN NULL;
    WHEN 'diaria' THEN
      RETURN current_date + (interval_value || ' days')::INTERVAL;
    WHEN 'semanal' THEN
      RETURN current_date + (interval_value || ' weeks')::INTERVAL;
    WHEN 'quinzenal' THEN
      RETURN current_date + (interval_value * 2 || ' weeks')::INTERVAL;
    WHEN 'mensal' THEN
      RETURN current_date + (interval_value || ' months')::INTERVAL;
    WHEN 'semestral' THEN
      RETURN current_date + (interval_value * 6 || ' months')::INTERVAL;
    WHEN 'anual' THEN
      RETURN current_date + (interval_value || ' years')::INTERVAL;
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

-- Criar usuário admin padrão (será criado via trigger quando fizer signup)
-- A role será alterada manualmente após o primeiro admin se registrar