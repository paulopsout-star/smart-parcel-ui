-- Caso de exceção: Marcar PIX como pago manualmente
-- Cobrança: d67eb497-03ac-412f-a1bb-54d7f1e323cc
-- Pagador: Anderlan Lahuri Dias Aires Karaja Silva

-- 1. Atualizar o payment_split do PIX para "concluded"
UPDATE payment_splits
SET 
  status = 'concluded',
  pix_paid_at = NOW(),
  processed_at = NOW()
WHERE id = '7a48c285-a784-41ad-bb0a-edccdf143049'
  AND charge_id = 'd67eb497-03ac-412f-a1bb-54d7f1e323cc'
  AND method = 'pix';

-- 2. Atualizar o status da cobrança para "processing" (parcialmente pago)
UPDATE charges
SET 
  status = 'processing',
  updated_at = NOW()
WHERE id = 'd67eb497-03ac-412f-a1bb-54d7f1e323cc';