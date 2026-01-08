-- Adicionar coluna para linha digitável fornecida pelo admin
-- Esta coluna armazena a linha digitável que será efetivamente vinculada ao pagamento
-- A coluna existente boleto_linha_digitavel continua armazenando a linha original do cadastro

ALTER TABLE public.charges 
ADD COLUMN IF NOT EXISTS boleto_admin_linha_digitavel TEXT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.charges.boleto_admin_linha_digitavel IS 'Linha digitável fornecida pelo admin para vinculação manual em pagamentos combinados (PIX + Cartão)';