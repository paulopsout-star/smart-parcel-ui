-- Adicionar foreign key entre subscriptions e profiles
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES public.profiles(id);