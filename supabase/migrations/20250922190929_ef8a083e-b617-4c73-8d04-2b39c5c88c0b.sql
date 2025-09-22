-- Adicionar foreign keys que estavam faltando nas tabelas auxiliares

-- Foreign key entre charge_messages e charges
ALTER TABLE public.charge_messages 
ADD CONSTRAINT fk_charge_messages_charge_id 
FOREIGN KEY (charge_id) REFERENCES public.charges(id) ON DELETE CASCADE;

-- Foreign key entre charge_messages e message_templates
ALTER TABLE public.charge_messages 
ADD CONSTRAINT fk_charge_messages_template_id 
FOREIGN KEY (template_id) REFERENCES public.message_templates(id) ON DELETE SET NULL;

-- Foreign key entre payment_splits e payment_links
ALTER TABLE public.payment_splits 
ADD CONSTRAINT fk_payment_splits_payment_link_id 
FOREIGN KEY (payment_link_id) REFERENCES public.payment_links(id) ON DELETE CASCADE;

-- Foreign key entre payment_splits e charges
ALTER TABLE public.payment_splits 
ADD CONSTRAINT fk_payment_splits_charge_id 
FOREIGN KEY (charge_id) REFERENCES public.charges(id) ON DELETE CASCADE;

-- Foreign key entre refund_jobs e payment_links
ALTER TABLE public.refund_jobs 
ADD CONSTRAINT fk_refund_jobs_payment_link_id 
FOREIGN KEY (payment_link_id) REFERENCES public.payment_links(id) ON DELETE CASCADE;

-- Foreign key entre refund_jobs e charges
ALTER TABLE public.refund_jobs 
ADD CONSTRAINT fk_refund_jobs_charge_id 
FOREIGN KEY (charge_id) REFERENCES public.charges(id) ON DELETE CASCADE;

-- Foreign key entre profiles e payout_accounts (conta padrão)
ALTER TABLE public.profiles 
ADD CONSTRAINT fk_profiles_default_payout_account_id 
FOREIGN KEY (default_payout_account_id) REFERENCES public.payout_accounts(id) ON DELETE SET NULL;