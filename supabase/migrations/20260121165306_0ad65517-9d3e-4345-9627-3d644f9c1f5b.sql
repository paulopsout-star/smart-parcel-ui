-- Adicionar colunas para integração Mercado Pago PIX
ALTER TABLE payment_splits 
ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
ADD COLUMN IF NOT EXISTS mp_qr_code TEXT,
ADD COLUMN IF NOT EXISTS mp_qr_code_base64 TEXT,
ADD COLUMN IF NOT EXISTS mp_ticket_url TEXT,
ADD COLUMN IF NOT EXISTS mp_status TEXT,
ADD COLUMN IF NOT EXISTS mp_status_detail TEXT,
ADD COLUMN IF NOT EXISTS mp_date_of_expiration TIMESTAMPTZ;

-- Criar índice para busca por mp_payment_id
CREATE INDEX IF NOT EXISTS idx_payment_splits_mp_payment_id ON payment_splits(mp_payment_id) WHERE mp_payment_id IS NOT NULL;