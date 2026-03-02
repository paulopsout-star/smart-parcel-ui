
CREATE INDEX IF NOT EXISTS idx_charges_company_created 
  ON public.charges (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_charges_created_at_desc 
  ON public.charges (created_at DESC);
