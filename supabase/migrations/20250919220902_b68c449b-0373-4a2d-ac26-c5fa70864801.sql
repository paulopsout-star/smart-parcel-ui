-- Criar enum para roles do sistema
CREATE TYPE public.app_role AS ENUM ('admin', 'operador');

-- Enum para tipos de recorrência
CREATE TYPE public.recurrence_type AS ENUM (
  'pontual', 'diaria', 'semanal', 'quinzenal', 
  'mensal', 'semestral', 'anual'
);

-- Enum para status de cobrança
CREATE TYPE public.charge_status AS ENUM (
  'pending', 'processing', 'completed', 'failed', 'cancelled'
);

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