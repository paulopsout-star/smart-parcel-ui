-- Corrigir splits PIX com taxa antiga de 5% para 1.5%
-- display_amount_cents = amount_cents * 1.05 (antigo) → amount_cents * 1.015 (novo)
UPDATE payment_splits 
SET display_amount_cents = ROUND(amount_cents * 1.015)
WHERE method = 'pix' 
  AND display_amount_cents IS NOT NULL
  AND ABS(display_amount_cents - ROUND(amount_cents * 1.05)) <= 1;