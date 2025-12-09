-- ============================================
-- SEGREGAÇÃO DE DADOS: Admin vê todas as empresas
-- ============================================

-- 1. Atualizar policy de SELECT para charges
DROP POLICY IF EXISTS "Users can view charges from their company" ON charges;

CREATE POLICY "Users can view charges based on role" ON charges
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  (is_admin_or_operador(auth.uid()) AND company_id = get_user_company_id(auth.uid()))
);

-- 2. Atualizar policy de SELECT para charge_executions
DROP POLICY IF EXISTS "Users can view executions from their company" ON charge_executions;

CREATE POLICY "Users can view executions based on role" ON charge_executions
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  (is_admin_or_operador(auth.uid()) AND company_id = get_user_company_id(auth.uid()))
);

-- 3. Atualizar policy de SELECT para payment_links
DROP POLICY IF EXISTS "Users can view payment links from their company" ON payment_links;

CREATE POLICY "Users can view payment links based on role" ON payment_links
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  (is_admin_or_operador(auth.uid()) AND company_id = get_user_company_id(auth.uid()))
);