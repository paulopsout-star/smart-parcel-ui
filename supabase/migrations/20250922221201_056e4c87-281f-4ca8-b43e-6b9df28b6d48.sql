-- Fix function search path security warning
CREATE OR REPLACE FUNCTION public.set_payment_link_defaults()
RETURNS trigger AS $$
BEGIN
  IF NEW.token IS NULL OR length(trim(NEW.token)) = 0 THEN
    NEW.token := replace(gen_random_uuid()::text, '-', '');
  END IF;
  IF NEW.url IS NULL OR length(trim(NEW.url)) = 0 THEN
    NEW.url := '/payment?token=' || NEW.token;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;