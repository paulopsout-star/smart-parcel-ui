-- Criar campo para armazenar linha digitável informativa em pagamentos combinados (cartao_pix)
-- Este campo é apenas informativo - o vínculo é feito manualmente pelo admin usando boleto_admin_linha_digitavel
ALTER TABLE charges 
ADD COLUMN IF NOT EXISTS boleto_pix_cartao_linha_digitavel TEXT;

COMMENT ON COLUMN charges.boleto_pix_cartao_linha_digitavel IS 
'Linha digitavel informada pelo usuario para pagamentos combinados (cartao_pix). Campo informativo - o vinculo e feito manualmente pelo admin usando boleto_admin_linha_digitavel.';