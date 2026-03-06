
-- 1) Create the optimized function
CREATE OR REPLACE FUNCTION public.can_access_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        ur.role = 'admin'
        OR (
          ur.role IN ('admin', 'operador')
          AND _company_id = (SELECT company_id FROM public.profiles WHERE id = _user_id)
        )
      )
  )
$$;

-- 2) charges: DROP old policies, CREATE new ones
DROP POLICY IF EXISTS "Users can view charges based on role" ON public.charges;
CREATE POLICY "Users can view charges based on role"
  ON public.charges FOR SELECT TO authenticated
  USING (can_access_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can create charges in their company" ON public.charges;
CREATE POLICY "Users can create charges in their company"
  ON public.charges FOR INSERT TO authenticated
  WITH CHECK (can_access_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can update charges from their company" ON public.charges;
CREATE POLICY "Users can update charges from their company"
  ON public.charges FOR UPDATE TO authenticated
  USING (can_access_company(auth.uid(), company_id))
  WITH CHECK (can_access_company(auth.uid(), company_id));

-- 3) charge_executions: DROP old SELECT policy, CREATE new one
DROP POLICY IF EXISTS "Users can view executions based on role" ON public.charge_executions;
CREATE POLICY "Users can view executions based on role"
  ON public.charge_executions FOR SELECT TO authenticated
  USING (can_access_company(auth.uid(), company_id));

-- 4) payment_links: DROP old SELECT and INSERT policies, CREATE new ones
DROP POLICY IF EXISTS "Users can view payment links based on role" ON public.payment_links;
CREATE POLICY "Users can view payment links based on role"
  ON public.payment_links FOR SELECT TO authenticated
  USING (can_access_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can create payment links in their company" ON public.payment_links;
CREATE POLICY "Users can create payment links in their company"
  ON public.payment_links FOR INSERT TO authenticated
  WITH CHECK (can_access_company(auth.uid(), company_id));
