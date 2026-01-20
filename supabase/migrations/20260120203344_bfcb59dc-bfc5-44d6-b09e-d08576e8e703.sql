-- Corrigir padrão preview--autonegocie.lovable.app nas charges
UPDATE charges 
SET checkout_url = REPLACE(
  checkout_url, 
  'https://preview--autonegocie.lovable.app', 
  'https://pay1.autonegocie.com'
)
WHERE checkout_url LIKE '%preview--autonegocie.lovable.app%';

-- Corrigir padrão autonegocie.lovable.app nas charges
UPDATE charges 
SET checkout_url = REPLACE(
  checkout_url, 
  'https://autonegocie.lovable.app', 
  'https://pay1.autonegocie.com'
)
WHERE checkout_url LIKE '%autonegocie.lovable.app%';

-- Corrigir padrão preview--autonegocie.lovable.app nos payment_links
UPDATE payment_links 
SET link_url = REPLACE(
  link_url, 
  'https://preview--autonegocie.lovable.app', 
  'https://pay1.autonegocie.com'
)
WHERE link_url LIKE '%preview--autonegocie.lovable.app%';

-- Corrigir padrão autonegocie.lovable.app nos payment_links
UPDATE payment_links 
SET link_url = REPLACE(
  link_url, 
  'https://autonegocie.lovable.app', 
  'https://pay1.autonegocie.com'
)
WHERE link_url LIKE '%autonegocie.lovable.app%';