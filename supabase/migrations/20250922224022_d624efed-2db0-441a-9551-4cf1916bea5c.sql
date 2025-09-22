-- CRITICAL SECURITY FIX: Remove dangerous public access to sensitive transaction data
DROP POLICY IF EXISTS "Anyone can view transactions" ON public.transactions;

-- Add secure role-based policies for transactions
CREATE POLICY "Admins and operadores can view transactions" 
ON public.transactions 
FOR SELECT 
USING (is_admin_or_operador(auth.uid()));

-- Keep the existing system insert policy but ensure it's properly secured
-- The "System can insert transactions" policy should remain as it's needed for payment processing

-- Add audit logging comment
COMMENT ON TABLE public.transactions IS 'Transactions table - Contains sensitive payment data. Access restricted to authenticated admin/operador users only.';

-- Additional security: Enable RLS on transactions if not already enabled
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;