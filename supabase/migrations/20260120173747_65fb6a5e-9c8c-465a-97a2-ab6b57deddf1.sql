-- Corrigir status do split de cartão para refletir API Cappta (statusCode 3 = BarcodeAssigned)
UPDATE payment_splits
SET status = 'boleto_linked'
WHERE id = 'bb2ec241-badc-4ce0-8453-55dfc64cb2d9'
  AND charge_id = 'd67eb497-03ac-412f-a1bb-54d7f1e323cc'
  AND method = 'credit_card';

-- Atualizar status da cobrança para boleto_linked (reflete API Cappta)
UPDATE charges
SET 
  status = 'boleto_linked',
  updated_at = NOW()
WHERE id = 'd67eb497-03ac-412f-a1bb-54d7f1e323cc';