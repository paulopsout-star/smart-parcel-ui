-- Corrigir status do charge para 'pending' (parcialmente pago - PIX ok, cartão pendente)
UPDATE charges 
SET status = 'pending', updated_at = now()
WHERE id = '526a9f56-0dc2-475e-a355-ff7b828eedc7';