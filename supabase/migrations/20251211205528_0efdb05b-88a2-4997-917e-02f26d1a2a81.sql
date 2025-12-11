-- Corrigir o split PIX que foi pago mas não teve status atualizado
UPDATE payment_splits 
SET 
  status = 'concluded', 
  pix_paid_at = '2025-12-11T19:12:53.680Z',
  processed_at = '2025-12-11T19:12:53.680Z'
WHERE id = '3147ee19-6f81-4590-9885-3c4bdb4294e2'
AND method = 'pix'
AND charge_id = '526a9f56-0dc2-475e-a355-ff7b828eedc7';