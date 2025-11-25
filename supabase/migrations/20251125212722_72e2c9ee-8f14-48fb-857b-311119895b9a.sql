-- Remover política RLS insegura que expõe dados sensíveis via token
-- A edge function public-payment-link já usa service_role para acesso seguro
DROP POLICY IF EXISTS "Public access via valid token" ON public.payment_links;

-- Garantir que apenas a política de service_role e usuários autenticados permaneçam ativas
-- (As outras políticas já existentes continuam válidas)