-- Fix critical security vulnerability in payment_links table
-- Remove overly permissive policy that allows anyone to access all payment data
DROP POLICY IF EXISTS "System can manage payment links" ON public.payment_links;

-- Create secure policy for public token-based access (customers accessing their specific payment link)
CREATE POLICY "Public access via valid token" 
ON public.payment_links 
FOR SELECT 
USING (
  -- Only allow access when a valid token is provided and matches
  -- This will be used by the public payment page when customers access their specific link
  token IS NOT NULL 
  AND token = current_setting('app.current_token', true)
);

-- Create policy for system operations (edge functions using service role)
CREATE POLICY "Service role can manage payment links" 
ON public.payment_links 
FOR ALL 
USING (
  -- Only service role (backend operations) can perform unrestricted operations
  auth.jwt() ->> 'role' = 'service_role'
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
);

-- Ensure existing admin/operator policies remain (they should already exist but let's be explicit)
-- These policies already exist but adding for clarity:
-- "Admins and operadores can view payment links" - allows authenticated staff to view all links
-- "Admins and operadores can create payment links" - allows authenticated staff to create links