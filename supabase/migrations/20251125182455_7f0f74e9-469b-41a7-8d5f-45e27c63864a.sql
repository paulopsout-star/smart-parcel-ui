-- Adicionar coluna payment_method na tabela charges
ALTER TABLE charges 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cartao';

-- Atualizar cobranças existentes para garantir consistência
UPDATE charges 
SET payment_method = 'cartao' 
WHERE payment_method IS NULL;