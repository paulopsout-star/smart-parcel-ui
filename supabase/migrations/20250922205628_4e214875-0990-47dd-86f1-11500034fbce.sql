-- Criar tabela para controle de exportações
CREATE TABLE IF NOT EXISTS public.export_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL,
  company_id     uuid NULL,
  format         text NOT NULL CHECK (format IN ('CSV','XLSX')),
  scope          text NOT NULL,                           -- 'transactions' | 'charges' | 'executions' | 'splits' | 'kpis'
  filters_json   jsonb NOT NULL,                          -- filtros aplicados
  status         text NOT NULL DEFAULT 'QUEUED',          -- QUEUED | RUNNING | DONE | FAILED
  file_path      text NULL,                               -- caminho no Storage
  rows_count     int  NULL,
  error          text NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz NULL,
  finished_at    timestamptz NULL
);

-- Habilitar RLS
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

-- Política para admins (podem ver tudo)
CREATE POLICY "Admins can manage all export jobs" ON public.export_jobs
  FOR ALL USING (is_admin_or_operador(auth.uid()))
  WITH CHECK (is_admin_or_operador(auth.uid()));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_export_jobs_owner ON public.export_jobs(owner_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON public.export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created ON public.export_jobs(created_at);

-- Bucket para exportações
INSERT INTO storage.buckets (id, name, public) 
VALUES ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas do storage para exports
CREATE POLICY "Admins can access exports" ON storage.objects
  FOR ALL USING (bucket_id = 'exports' AND is_admin_or_operador(auth.uid()))
  WITH CHECK (bucket_id = 'exports' AND is_admin_or_operador(auth.uid()));

-- Comentários para documentação
COMMENT ON TABLE public.export_jobs IS 'Controle de exportações assíncronas de relatórios';
COMMENT ON COLUMN public.export_jobs.scope IS 'Tipo de dados exportados: transactions, charges, executions, splits, kpis';
COMMENT ON COLUMN public.export_jobs.filters_json IS 'Filtros aplicados na exportação';
COMMENT ON COLUMN public.export_jobs.status IS 'QUEUED | RUNNING | DONE | FAILED';
COMMENT ON COLUMN public.export_jobs.file_path IS 'Caminho do arquivo no Storage';