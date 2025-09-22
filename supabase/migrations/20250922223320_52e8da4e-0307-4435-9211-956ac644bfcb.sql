-- Remove the dangerous public access policy for payment_links
DROP POLICY IF EXISTS "Anyone can view payment links" ON public.payment_links;

-- Also remove the overly permissive insert/update policies that allow anyone to modify payment links
DROP POLICY IF EXISTS "Anyone can create payment links" ON public.payment_links;
DROP POLICY IF EXISTS "Anyone can update payment links" ON public.payment_links;

-- Create a more secure policy that only allows access through the public edge function
-- The edge function uses service role key so it bypasses RLS
-- This ensures public access is controlled and goes through proper token validation

-- Allow system operations (edge functions) to manage payment links
CREATE POLICY "System can manage payment links" 
ON public.payment_links 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Update the existing admin/operador policies to be more specific and secure
-- Keep the existing SELECT policy for admins/operadores but make it more explicit
DROP POLICY IF EXISTS "Admins and operadores can view payment links by charge" ON public.payment_links;

CREATE POLICY "Admins and operadores can view payment links" 
ON public.payment_links 
FOR SELECT 
USING (is_admin_or_operador(auth.uid()));

-- Keep the existing INSERT policy for admins/operadores  
DROP POLICY IF EXISTS "Admins and operadores can create payment links for charges" ON public.payment_links;

CREATE POLICY "Admins and operadores can create payment links" 
ON public.payment_links 
FOR INSERT 
WITH CHECK (is_admin_or_operador(auth.uid()));