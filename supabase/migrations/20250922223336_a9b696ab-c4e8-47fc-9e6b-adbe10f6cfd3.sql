-- Remove the dangerous public access policies for payment_links
DROP POLICY IF EXISTS "Anyone can view payment links" ON public.payment_links;
DROP POLICY IF EXISTS "Anyone can create payment links" ON public.payment_links;
DROP POLICY IF EXISTS "Anyone can update payment links" ON public.payment_links;

-- The existing "System can manage payment links" policy should remain
-- The existing admin/operador policies should remain

-- Add a comment to document the security fix
COMMENT ON TABLE public.payment_links IS 'Payment links table - Access restricted to authenticated users only. Public access only through secure token-based edge functions.';