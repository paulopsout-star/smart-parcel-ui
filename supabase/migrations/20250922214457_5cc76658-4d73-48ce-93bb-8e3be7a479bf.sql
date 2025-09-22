-- Add charge_id column to payment_links table for relationship tracking
ALTER TABLE public.payment_links 
ADD COLUMN charge_id UUID REFERENCES public.charges(id);

-- Create index for better performance on charge_id lookups  
CREATE INDEX idx_payment_links_charge_id ON public.payment_links(charge_id);

-- Add RLS policies for charge-links function access
CREATE POLICY "Admins and operadores can view payment links by charge"
ON public.payment_links
FOR SELECT
TO authenticated
USING (
  is_admin_or_operador(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.charges 
    WHERE charges.id = payment_links.charge_id 
    AND is_admin_or_operador(auth.uid())
  )
);

CREATE POLICY "Admins and operadores can create payment links for charges"
ON public.payment_links
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin_or_operador(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.charges 
    WHERE charges.id = payment_links.charge_id 
    AND is_admin_or_operador(auth.uid())
  )
);