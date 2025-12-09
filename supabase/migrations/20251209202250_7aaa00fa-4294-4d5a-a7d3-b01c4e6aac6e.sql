-- Adicionar novos valores ao enum charge_status para mapear todos os status da API Quita+
ALTER TYPE charge_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE charge_status ADD VALUE IF NOT EXISTS 'awaiting_validation';
ALTER TYPE charge_status ADD VALUE IF NOT EXISTS 'validating';
ALTER TYPE charge_status ADD VALUE IF NOT EXISTS 'payment_denied';