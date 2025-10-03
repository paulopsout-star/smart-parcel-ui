-- Adicionar campos necessários para controle de ordem e pagamento em payment_splits
ALTER TABLE public.payment_splits
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS pix_paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para melhor performance nas queries de ordem
CREATE INDEX IF NOT EXISTS idx_payment_splits_order ON public.payment_splits(charge_id, order_index);

-- Comentários para documentação
COMMENT ON COLUMN public.payment_splits.order_index IS 'Ordem de processamento: 1=PIX (primeiro), 2=CARD (após PIX)';
COMMENT ON COLUMN public.payment_splits.installments IS 'Número de parcelas para pagamento com cartão';
COMMENT ON COLUMN public.payment_splits.pix_paid_at IS 'Timestamp de quando o PIX foi confirmado';
COMMENT ON COLUMN public.payment_splits.refund_requested_at IS 'Timestamp de quando o estorno foi solicitado';
COMMENT ON COLUMN public.payment_splits.refunded_at IS 'Timestamp de quando o estorno foi concluído';