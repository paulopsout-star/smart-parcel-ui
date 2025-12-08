-- Criar tabela de leads para captura de contatos
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  company VARCHAR(100),
  source VARCHAR(50) DEFAULT 'landing_hero',
  created_at TIMESTAMPTZ DEFAULT now(),
  converted_at TIMESTAMPTZ,
  notes TEXT
);

-- Habilitar RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Política: qualquer um pode inserir leads (público)
CREATE POLICY "Anyone can insert leads" ON public.leads
  FOR INSERT WITH CHECK (true);

-- Política: apenas admins autenticados podem visualizar
CREATE POLICY "Admins can view leads" ON public.leads
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Política: apenas admins podem atualizar
CREATE POLICY "Admins can update leads" ON public.leads
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Índice para buscas por email
CREATE INDEX idx_leads_email ON public.leads(email);

-- Índice para ordenação por data
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);