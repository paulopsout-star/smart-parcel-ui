-- 1.1 garantir colunas
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS token text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS url text;

-- 1.2 trigger: preenche token/url se vierem nulos
CREATE OR REPLACE FUNCTION public.set_payment_link_defaults()
RETURNS trigger AS $$
BEGIN
  IF NEW.token IS NULL OR length(trim(NEW.token)) = 0 THEN
    NEW.token := replace(gen_random_uuid()::text, '-', ''); -- curto e único  
  END IF;
  IF NEW.url IS NULL OR length(trim(NEW.url)) = 0 THEN
    NEW.url := '/payment?token=' || NEW.token;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_links_defaults ON public.payment_links;
CREATE TRIGGER trg_payment_links_defaults
BEFORE INSERT ON public.payment_links
FOR EACH ROW EXECUTE FUNCTION public.set_payment_link_defaults();

-- 1.3 unicidade só para ACTIVE (evita 2 ativos por cobrança)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_links_active_per_charge
  ON public.payment_links (charge_id)
  WHERE status = 'active';

-- 1.4 token único (checkout público)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_links_token
  ON public.payment_links (token);