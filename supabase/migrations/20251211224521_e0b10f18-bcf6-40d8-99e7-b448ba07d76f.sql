-- Adicionar política RLS de SELECT público para payment_splits
-- Necessário para páginas de checkout funcionarem sem autenticação

CREATE POLICY "Public can read payment splits"
ON public.payment_splits
FOR SELECT
USING (true);