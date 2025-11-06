-- Adicionar colunas creditor_document e creditor_name na tabela charges
ALTER TABLE charges 
ADD COLUMN IF NOT EXISTS creditor_document TEXT,
ADD COLUMN IF NOT EXISTS creditor_name TEXT;