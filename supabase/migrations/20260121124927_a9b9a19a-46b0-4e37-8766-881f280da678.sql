-- Corrigir inconsistência: payment_split marcado como 'expired' mas API Quita+ confirma pagamento (statusCode 9 = Paid)
UPDATE payment_splits 
SET 
  status = 'concluded',
  processed_at = NOW()
WHERE id = '538dca6c-dda1-4c5c-8770-30461d19bccb'
  AND status = 'expired';