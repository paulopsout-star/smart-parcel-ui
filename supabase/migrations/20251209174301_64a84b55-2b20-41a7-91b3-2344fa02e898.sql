-- FASE 3: Adicionar novos campos na tabela charges
ALTER TABLE public.charges 
ADD COLUMN IF NOT EXISTS pre_payment_key TEXT,
ADD COLUMN IF NOT EXISTS boleto_linked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_authorized_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Adicionar novos valores ao enum charge_status
ALTER TYPE public.charge_status ADD VALUE IF NOT EXISTS 'pre_authorized';
ALTER TYPE public.charge_status ADD VALUE IF NOT EXISTS 'boleto_linked';

-- Adicionar campos para split de pagamento (Cartão + PIX)
ALTER TABLE public.charges 
ADD COLUMN IF NOT EXISTS pix_amount INTEGER,
ADD COLUMN IF NOT EXISTS card_amount INTEGER;

-- Índice para busca por pre_payment_key
CREATE INDEX IF NOT EXISTS idx_charges_pre_payment_key ON public.charges(pre_payment_key) WHERE pre_payment_key IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.charges.pre_payment_key IS 'Chave de pré-autorização retornada pela API Quita+';
COMMENT ON COLUMN public.charges.boleto_linked_at IS 'Timestamp quando o boleto foi vinculado com sucesso';
COMMENT ON COLUMN public.charges.payment_authorized_at IS 'Timestamp quando o pagamento foi autorizado';
COMMENT ON COLUMN public.charges.completed_at IS 'Timestamp quando o pagamento foi concluído';
COMMENT ON COLUMN public.charges.pix_amount IS 'Valor em centavos para pagamento via PIX (quando método é cartao_pix)';
COMMENT ON COLUMN public.charges.card_amount IS 'Valor em centavos para pagamento via cartão (quando método é cartao_pix)';