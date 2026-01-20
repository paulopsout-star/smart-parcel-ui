-- Corrigir último padrão restante
UPDATE payment_links 
SET link_url = REPLACE(
  link_url, 
  'https://smart-parcel-ui.lovable.app', 
  'https://pay1.autonegocie.com'
)
WHERE link_url LIKE '%smart-parcel-ui.lovable.app%';