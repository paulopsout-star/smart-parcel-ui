-- Corrigir checkout_url na tabela charges (padrão lovableproject.com)
UPDATE charges 
SET checkout_url = REPLACE(
  checkout_url, 
  'https://eaddac47-07ed-4011-8ff8-fc1b25fafe6b.lovableproject.com', 
  'https://pay1.autonegocie.com'
)
WHERE checkout_url LIKE '%eaddac47-07ed-4011-8ff8-fc1b25fafe6b.lovableproject.com%';

-- Corrigir checkout_url na tabela charges (padrão lovable.app preview)
UPDATE charges 
SET checkout_url = REPLACE(
  checkout_url, 
  'https://id-preview--eaddac47-07ed-4011-8ff8-fc1b25fafe6b.lovable.app', 
  'https://pay1.autonegocie.com'
)
WHERE checkout_url LIKE '%id-preview--eaddac47-07ed-4011-8ff8-fc1b25fafe6b.lovable.app%';

-- Corrigir link_url na tabela payment_links (padrão lovableproject.com)
UPDATE payment_links 
SET link_url = REPLACE(
  link_url, 
  'https://eaddac47-07ed-4011-8ff8-fc1b25fafe6b.lovableproject.com', 
  'https://pay1.autonegocie.com'
)
WHERE link_url LIKE '%eaddac47-07ed-4011-8ff8-fc1b25fafe6b.lovableproject.com%';

-- Corrigir link_url na tabela payment_links (padrão lovable.app preview)
UPDATE payment_links 
SET link_url = REPLACE(
  link_url, 
  'https://id-preview--eaddac47-07ed-4011-8ff8-fc1b25fafe6b.lovable.app', 
  'https://pay1.autonegocie.com'
)
WHERE link_url LIKE '%id-preview--eaddac47-07ed-4011-8ff8-fc1b25fafe6b.lovable.app%';