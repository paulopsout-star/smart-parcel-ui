-- Corrigir o split de cartão existente que tem valores invertidos
-- O valor 2372 (já com juros) vai para display_amount_cents
-- O valor ORIGINAL 2200 (do charges.card_amount) vai para amount_cents
UPDATE payment_splits 
SET 
  display_amount_cents = 2372,
  amount_cents = 2200
WHERE id = 'dedbb0d1-b55a-4cc8-b393-986273a31502'
AND method = 'credit_card'
AND charge_id = '526a9f56-0dc2-475e-a355-ff7b828eedc7';