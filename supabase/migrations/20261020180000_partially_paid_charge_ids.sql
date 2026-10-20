-- IDs das cobranças combinadas "Parcialmente Pago": exatamente um dos dois meios (PIX ou cartão)
-- está concluído. Mesma regra do rótulo calculado na lista (getDisplayStatus em ChargeHistory).
-- security invoker: respeita o RLS de charges/payment_splits do usuário logado.
create or replace function public.partially_paid_charge_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select c.id
  from public.charges c
  where c.payment_method = 'cartao_pix'
    and c.status_locked_at is null
    and (
      exists (
        select 1 from public.payment_splits s
        where s.charge_id = c.id and s.method = 'pix'
          and (s.status = 'concluded' or s.pix_paid_at is not null)
      )
    ) <> (
      exists (
        select 1 from public.payment_splits s
        where s.charge_id = c.id and s.method = 'credit_card' and s.status = 'concluded'
      )
    );
$$;

grant execute on function public.partially_paid_charge_ids() to authenticated, service_role;
