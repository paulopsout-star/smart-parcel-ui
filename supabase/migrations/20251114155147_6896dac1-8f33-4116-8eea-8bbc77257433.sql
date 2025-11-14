-- Fase 3: Remover coluna role duplicada da tabela profiles
-- A coluna role agora existe apenas em user_roles (fonte única da verdade)

-- Verificar se existem dados inconsistentes antes de remover
DO $$
DECLARE
  inconsistent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO inconsistent_count
  FROM profiles p
  LEFT JOIN user_roles ur ON p.id = ur.user_id
  WHERE p.role IS DISTINCT FROM ur.role;
  
  IF inconsistent_count > 0 THEN
    RAISE NOTICE 'Encontrados % registros com roles inconsistentes', inconsistent_count;
  END IF;
END $$;

-- Remover a coluna role da tabela profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS role;

-- Adicionar comentário para documentação
COMMENT ON TABLE profiles IS 'Perfis de usuário. Roles são gerenciadas na tabela user_roles.';
COMMENT ON TABLE user_roles IS 'Fonte única da verdade para roles de usuários. Nunca duplicar esta informação em outras tabelas.';