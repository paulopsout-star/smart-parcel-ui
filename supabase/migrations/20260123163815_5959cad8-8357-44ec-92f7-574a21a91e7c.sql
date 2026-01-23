-- Adicionar coluna sync_attempts na tabela charges
ALTER TABLE charges 
ADD COLUMN IF NOT EXISTS sync_attempts integer DEFAULT 0;

COMMENT ON COLUMN charges.sync_attempts IS 
  'Contador de tentativas de sincronizacao sem mudanca de status. Apos 5 tentativas, para de re-verificar.';