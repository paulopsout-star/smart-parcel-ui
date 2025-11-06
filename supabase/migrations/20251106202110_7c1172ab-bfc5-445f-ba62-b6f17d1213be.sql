-- Add Quita+ integration columns to payment_splits
ALTER TABLE public.payment_splits 
ADD COLUMN IF NOT EXISTS pre_payment_key TEXT,
ADD COLUMN IF NOT EXISTS authorization_code TEXT,
ADD COLUMN IF NOT EXISTS link_id TEXT;

-- Add index for faster lookups by pre_payment_key
CREATE INDEX IF NOT EXISTS idx_payment_splits_pre_payment_key ON public.payment_splits(pre_payment_key);

-- Add comment for documentation
COMMENT ON COLUMN public.payment_splits.pre_payment_key IS 'Quita+ pre-payment authorization key';
COMMENT ON COLUMN public.payment_splits.authorization_code IS 'Quita+ authorization code from pre-payment';
COMMENT ON COLUMN public.payment_splits.link_id IS 'Quita+ link ID when boleto is associated with pre-payment';