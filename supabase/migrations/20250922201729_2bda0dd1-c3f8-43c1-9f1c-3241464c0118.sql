-- MICRO-ENTREGA #2: Add boleto link fields to charges table
-- Adding fields to support boleto linking functionality for pontual charges

ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS has_boleto_link boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boleto_linha_digitavel text NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.charges.has_boleto_link IS 'Indicates if the charge has a boleto link (simulated for now)';
COMMENT ON COLUMN public.charges.boleto_linha_digitavel IS 'Normalized boleto linha digitável (digits only, 47-48 characters)';