-- Criar usuário administrador no sistema de autenticação
-- Como o Supabase não permite inserção direta na tabela auth.users via SQL,
-- vamos usar uma abordagem alternativa: criar o perfil primeiro e depois
-- o usuário poderá ser criado via interface

-- Primeiro, vamos inserir um perfil de administrador com ID fixo
-- que será usado quando o usuário se registrar
INSERT INTO public.profiles (id, full_name, role, is_active)
VALUES (
  '2632a83d-66cb-439a-96a9-26518eaef51d'::uuid,
  'Administrador do Sistema',
  'admin'::app_role,
  true
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

-- Criar uma função para permitir registro do admin
CREATE OR REPLACE FUNCTION public.create_admin_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Esta função será chamada pela aplicação para criar o usuário admin
  -- O ID deve corresponder ao perfil criado acima
  NULL; -- Placeholder - a criação real será feita via aplicação
END;
$$;