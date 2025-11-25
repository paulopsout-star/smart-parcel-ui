-- Desabilitar sistema de assinaturas: Atualizar todas as assinaturas para ACTIVE
UPDATE subscriptions 
SET 
  status = 'ACTIVE',
  canceled_at = NULL,
  current_period_end = now() + interval '10 years',
  grace_days = 365
WHERE status != 'ACTIVE';