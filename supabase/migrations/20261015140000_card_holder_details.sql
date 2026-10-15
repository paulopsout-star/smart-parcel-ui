-- Dados do portador do cartão informados no checkout.
--
-- Contexto: o pagador enviado ao Quita+/Cappta passa a ser SEMPRE o cadastro da
-- cobrança (charges/payment_links). Os dados que o cliente digita na etapa do
-- cartão passam a descrever o PORTADOR do cartão e ficam guardados aqui, apenas
-- para consulta no painel ("Dados do Portador do Cartão").

CREATE TYPE public.card_holder_relationship AS ENUM (
  'self',        -- Sou o portador do cartão
  'spouse',      -- Cônjuge
  'parent',      -- Pai/Mãe
  'child',       -- Filho(a)
  'sibling',     -- Irmão/Irmã
  'uncle_aunt',  -- Tio(a)
  'cousin',      -- Primo(a)
  'grandparent', -- Vô/Vó
  'friend'       -- Amigo(a)
);

CREATE TABLE public.card_holder_details (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  charge_id         uuid REFERENCES public.charges(id) ON DELETE CASCADE,
  payment_link_id   uuid REFERENCES public.payment_links(id) ON DELETE SET NULL,
  payment_split_id  uuid REFERENCES public.payment_splits(id) ON DELETE SET NULL,
  pre_payment_key   text,
  holder_name       text NOT NULL,
  holder_document   text NOT NULL,
  holder_birth_date date,
  holder_phone      text,
  holder_email      text,
  relationship      public.card_holder_relationship NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX card_holder_details_charge_id_idx ON public.card_holder_details (charge_id, created_at DESC);
CREATE INDEX card_holder_details_payment_split_id_idx ON public.card_holder_details (payment_split_id);

ALTER TABLE public.card_holder_details ENABLE ROW LEVEL SECURITY;

-- Leitura: mesma regra das cobranças (usuários da empresa / admin).
-- Escrita: somente pela edge function quitaplus-prepayment (service role) — sem policy de INSERT/UPDATE.
CREATE POLICY "Users can view card holder details based on role"
  ON public.card_holder_details FOR SELECT TO authenticated
  USING (can_access_company(auth.uid(), company_id));
