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

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_charges_updated_at
  BEFORE UPDATE ON public.charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular próxima data de cobrança
CREATE OR REPLACE FUNCTION public.calculate_next_charge_date(
  base_date TIMESTAMP WITH TIME ZONE,
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
      RETURN base_date + (interval_value || ' days')::INTERVAL;
    WHEN 'semanal' THEN
      RETURN base_date + (interval_value || ' weeks')::INTERVAL;
    WHEN 'quinzenal' THEN
      RETURN base_date + (interval_value * 2 || ' weeks')::INTERVAL;
    WHEN 'mensal' THEN
      RETURN base_date + (interval_value || ' months')::INTERVAL;
    WHEN 'semestral' THEN
      RETURN base_date + (interval_value * 6 || ' months')::INTERVAL;
    WHEN 'anual' THEN
      RETURN base_date + (interval_value || ' years')::INTERVAL;
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;