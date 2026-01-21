
-- Corrigir status da cobrança do Anderlan (f570faca) para validating
-- Status API Quita+: statusCode 4 (Settled) = em análise pelo robô de risco
UPDATE charges 
SET status = 'validating',
    updated_at = NOW()
WHERE id = 'eabeb156-0608-4dcd-94ff-12a77f991df4'
  AND pre_payment_key = 'f570faca-f31d-4cdb-9b34-b12e4f22ff16';

-- Corrigir status do payment_split de cartão para validating
UPDATE payment_splits 
SET status = 'validating',
    processed_at = NULL
WHERE charge_id = 'eabeb156-0608-4dcd-94ff-12a77f991df4'
  AND method = 'credit_card';
