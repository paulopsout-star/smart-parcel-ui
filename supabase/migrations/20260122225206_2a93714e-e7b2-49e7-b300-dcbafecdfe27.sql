-- =====================================================
-- ADMIN: Permitir criar/editar cobranças para qualquer empresa
-- =====================================================

-- 1. Remover policies existentes de INSERT e UPDATE
DROP POLICY IF EXISTS "Users can create charges in their company" ON public.charges;
DROP POLICY IF EXISTS "Users can update charges from their company" ON public.charges;

-- 2. Nova policy de INSERT: Admin pode inserir em qualquer empresa
CREATE POLICY "Users can create charges in their company"
ON public.charges FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_admin_or_operador(auth.uid()) AND company_id = get_user_company_id(auth.uid()))
);

-- 3. Nova policy de UPDATE: Admin pode atualizar qualquer cobrança
CREATE POLICY "Users can update charges from their company"
ON public.charges FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_admin_or_operador(auth.uid()) AND company_id = get_user_company_id(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_admin_or_operador(auth.uid()) AND company_id = get_user_company_id(auth.uid()))
);