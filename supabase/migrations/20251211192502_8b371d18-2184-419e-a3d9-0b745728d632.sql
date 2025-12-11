-- Adicionar coluna display_amount_cents para armazenar valor COM JUROS (para exibição)
-- amount_cents continua sendo o valor ORIGINAL (enviado para API)
ALTER TABLE payment_splits 
ADD COLUMN IF NOT EXISTS display_amount_cents INTEGER;

COMMENT ON COLUMN payment_splits.display_amount_cents IS 
'Valor com juros/taxas para exibição ao cliente. amount_cents contém o valor original enviado à API.';