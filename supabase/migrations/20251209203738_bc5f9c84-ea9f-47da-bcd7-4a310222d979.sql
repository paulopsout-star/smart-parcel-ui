-- Corrigir a cobrança 7d638475-31fd-4da6-a48f-e1fe8fff95c0
-- O boleto já foi vinculado com sucesso (API retornou StatusCode 3 = BarcodeAssigned)
-- Atualizar status e limpar erro de link_boleto_error

UPDATE charges 
SET 
  status = 'boleto_linked',
  boleto_linked_at = now(),
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb) - 'link_boleto_error',
    '{link_boleto_error}',
    'null'::jsonb
  ) - 'link_boleto_error'
WHERE id = '7d638475-31fd-4da6-a48f-e1fe8fff95c0';