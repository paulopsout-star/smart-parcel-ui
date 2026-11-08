-- Modalidade "sem juros" (Quita+ com credencial, lojista e credor próprios) — etapa 1: banco.
--
-- Tudo aqui é ADITIVO e fica INERTE até o interruptor geral ser ligado:
--   * app_settings.sem_juros_ativo = false (interruptor geral; só admin altera)
--   * profiles.sem_juros_habilitado = false (parâmetro por usuário; só admin altera)
--   * charges.modalidade = 'com_juros' para toda cobrança, até o gatilho encontrar uma simulação
--     sem juros válida de um usuário habilitado com o interruptor ligado.
--
-- Regra de negócio (espelha src/lib/sem-juros.ts — manter as duas em sincronia):
--   desconto = (dívida − à vista) / dívida
--   ≥ 30% → 12x · ≥ 27% → 9x · ≥ 25% → 6x · ≥ 20% → 3x · < 20% → não elegível (fluxo com juros)
--   até 30%: operação retém todo o desconto (cliente paga a dívida integral)
--   acima de 30%: operação retém no máximo 35% DA DÍVIDA; o excedente volta ao cliente
--   parcela mínima R$ 20,00; taxa de PIX zero nesta modalidade
--
-- Reversão: docs/rollback/20261107180000_sem_juros_modalidade.down.sql

-- ---------------------------------------------------------------------------
-- 1. Interruptor geral
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
comment on table public.app_settings is 'Configurações globais da plataforma (interruptores de funcionalidade). Leitura: autenticados. Escrita: admin.';

alter table public.app_settings enable row level security;

drop policy if exists "app_settings: leitura autenticada" on public.app_settings;
create policy "app_settings: leitura autenticada"
  on public.app_settings for select to authenticated using (true);

drop policy if exists "app_settings: admin altera" on public.app_settings;
create policy "app_settings: admin altera"
  on public.app_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Desde 30/10/2026 tabela nova em public precisa de GRANT explícito
grant select on table public.app_settings to authenticated;
grant all on table public.app_settings to service_role;

insert into public.app_settings (key, value, description)
values ('sem_juros_ativo', 'false'::jsonb, 'Interruptor geral da modalidade sem juros. false = ninguém cria cobrança sem juros, mesmo habilitado.')
on conflict (key) do nothing;

create or replace function public.sem_juros_ativo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select (value)::text = 'true' from public.app_settings where key = 'sem_juros_ativo'), false);
$$;
grant execute on function public.sem_juros_ativo() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Parâmetro por usuário (só admin altera)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists sem_juros_habilitado boolean not null default false;
comment on column public.profiles.sem_juros_habilitado is 'Usuário pode criar cobranças na modalidade sem juros (obriga a passar pela simulação).';

create or replace function public.protect_sem_juros_habilitado()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- service_role / jobs (auth.uid() nulo) podem alterar; usuário comum, não; admin, sim.
  if new.sem_juros_habilitado is distinct from old.sem_juros_habilitado
     and auth.uid() is not null
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Somente um administrador pode alterar o parâmetro sem juros do usuário'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_sem_juros_habilitado on public.profiles;
create trigger trg_protect_sem_juros_habilitado
  before update of sem_juros_habilitado on public.profiles
  for each row execute function public.protect_sem_juros_habilitado();

-- Usado pelo front: interruptor ligado E usuário habilitado
create or replace function public.sem_juros_habilitado()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.sem_juros_ativo()
     and coalesce((select p.sem_juros_habilitado from public.profiles p where p.id = auth.uid()), false);
$$;
grant execute on function public.sem_juros_habilitado() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Modalidade na cobrança
-- ---------------------------------------------------------------------------
alter table public.charges add column if not exists modalidade text not null default 'com_juros';
alter table public.charges drop constraint if exists charges_modalidade_check;
alter table public.charges add constraint charges_modalidade_check check (modalidade in ('com_juros', 'sem_juros'));
comment on column public.charges.modalidade is 'com_juros = fluxo atual do Quita+. sem_juros = credencial/lojista/credor sem juros; parcelas limitadas pela faixa de desconto.';
create index if not exists idx_charges_modalidade_sem_juros on public.charges (modalidade) where modalidade = 'sem_juros';

-- ---------------------------------------------------------------------------
-- 4. Tabela de faixas em SQL (mesma regra de src/lib/sem-juros.ts)
-- ---------------------------------------------------------------------------
create or replace function public.sem_juros_regras(p_divida_cents integer, p_a_vista_cents integer)
returns table (
  elegivel              boolean,
  parcelas_maximas      integer,
  desconto_cents        integer,
  desconto_pct          numeric,
  desconto_retido_cents integer,
  total_cliente_cents   integer,
  abatimento_cents      integer
)
language plpgsql immutable
as $$
declare
  v_desconto integer;
  v_pct      numeric;
  v_retido   integer;
begin
  if coalesce(p_divida_cents, 0) <= 0 or coalesce(p_a_vista_cents, 0) <= 0 or p_a_vista_cents > p_divida_cents then
    return query select false, 0, 0, 0::numeric, 0, 0, 0;
    return;
  end if;

  v_desconto := p_divida_cents - p_a_vista_cents;
  v_pct := v_desconto::numeric / p_divida_cents;

  parcelas_maximas := case
    when v_pct + 1e-9 >= 0.30 then 12
    when v_pct + 1e-9 >= 0.27 then 9
    when v_pct + 1e-9 >= 0.25 then 6
    when v_pct + 1e-9 >= 0.20 then 3
    else 0 end;

  -- até 30%: retém tudo; acima: retém no máximo 35% da dívida (MODO_LIMITE_RETIDO = 'sobre_a_divida')
  if v_pct <= 0.30 then
    v_retido := v_desconto;
  else
    v_retido := least(v_desconto, round(p_divida_cents * 0.35)::integer);
  end if;

  elegivel              := parcelas_maximas > 0;
  desconto_cents        := v_desconto;
  desconto_pct          := v_pct;
  desconto_retido_cents := v_retido;
  total_cliente_cents   := p_a_vista_cents + v_retido;
  abatimento_cents      := p_divida_cents - total_cliente_cents;
  return next;
end;
$$;
grant execute on function public.sem_juros_regras(integer, integer) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Gatilho: decide e valida a modalidade no insert; modalidade imutável depois
-- ---------------------------------------------------------------------------
create or replace function public.charges_definir_modalidade()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  sj          jsonb;
  r           record;
  v_pix       integer;
  v_cartao    integer;
  v_parcelas  integer;
  v_habilitado boolean;
  v_com_cartao boolean;
begin
  -- Fluxo atual: sem simulação sem juros → com_juros, sem nenhuma outra verificação.
  if tg_op = 'INSERT' and not (coalesce(new.metadata, '{}'::jsonb) ? 'sem_juros') then
    new.modalidade := 'com_juros';

    -- Simulação obrigatória: usuário habilitado, interruptor ligado e cobrança com cartão
    -- precisa trazer o carimbo da simulação (metadata.simulacao) mesmo quando cai no fluxo com juros.
    v_com_cartao := new.payment_method in ('cartao', 'cartao_pix');
    if v_com_cartao and public.sem_juros_ativo() then
      select p.sem_juros_habilitado into v_habilitado from public.profiles p where p.id = new.created_by;
      if coalesce(v_habilitado, false) and not (coalesce(new.metadata, '{}'::jsonb) ? 'simulacao') then
        raise exception 'Para este usuário a cobrança com cartão precisa começar pela simulação'
          using errcode = 'P0001', hint = 'sem_juros_simulacao_obrigatoria';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.modalidade is distinct from old.modalidade then
      raise exception 'A modalidade da cobrança não pode ser alterada' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- INSERT com metadata.sem_juros: só vale com interruptor ligado e usuário habilitado
  if not public.sem_juros_ativo() then
    raise exception 'Modalidade sem juros desativada' using errcode = 'P0001', hint = 'sem_juros_desativado';
  end if;
  select p.sem_juros_habilitado into v_habilitado from public.profiles p where p.id = new.created_by;
  if not coalesce(v_habilitado, false) then
    raise exception 'Usuário não habilitado para a modalidade sem juros' using errcode = 'P0001', hint = 'sem_juros_nao_habilitado';
  end if;

  sj := new.metadata -> 'sem_juros';
  select * into r from public.sem_juros_regras((sj->>'divida_cents')::integer, (sj->>'a_vista_cents')::integer);
  if not r.elegivel then
    raise exception 'Desconto do credor abaixo de 20%%: a cobrança deve seguir o fluxo com juros' using errcode = 'P0001', hint = 'sem_juros_nao_elegivel';
  end if;

  v_pix    := coalesce((sj->>'pix_cents')::integer, 0);
  v_cartao := r.total_cliente_cents - v_pix;
  if v_pix < 0 or v_cartao < 0 then
    raise exception 'PIX maior que o total do cliente' using errcode = 'P0001';
  end if;

  -- Valores da cobrança têm que ser os da regra, não os informados pela tela
  if new.amount <> r.total_cliente_cents then
    raise exception 'Valor da cobrança (%) difere do total sem juros calculado (%)', new.amount, r.total_cliente_cents using errcode = 'P0001', hint = 'sem_juros_valor_divergente';
  end if;
  if new.payment_method = 'cartao_pix' and (coalesce(new.pix_amount, -1) <> v_pix or coalesce(new.card_amount, -1) <> v_cartao) then
    raise exception 'PIX/cartão da cobrança diferem da simulação sem juros' using errcode = 'P0001', hint = 'sem_juros_split_divergente';
  end if;
  if new.payment_method = 'cartao' and v_pix <> 0 then
    raise exception 'Simulação com PIX exige pagamento combinado' using errcode = 'P0001';
  end if;

  -- Parcelas: dentro da faixa e com mínimo de R$ 20,00
  v_parcelas := coalesce(new.installments, 1);
  if v_cartao > 0 then
    if v_parcelas < 1 or v_parcelas > r.parcelas_maximas then
      raise exception 'Parcelas (%) fora da faixa sem juros (máximo %)', v_parcelas, r.parcelas_maximas using errcode = 'P0001', hint = 'sem_juros_parcelas';
    end if;
    if v_parcelas > 1 and (v_cartao / v_parcelas) < 2000 then
      raise exception 'Parcela abaixo de R$ 20,00' using errcode = 'P0001', hint = 'sem_juros_parcela_minima';
    end if;
  end if;

  -- Normaliza o que a tela gravou com o cálculo do servidor (fonte da verdade)
  new.metadata := jsonb_set(new.metadata, '{sem_juros}', sj || jsonb_build_object(
    'desconto_cents',        r.desconto_cents,
    'desconto_pct',          round(r.desconto_pct, 6),
    'desconto_retido_cents', r.desconto_retido_cents,
    'total_cliente_cents',   r.total_cliente_cents,
    'abatimento_cents',      r.abatimento_cents,
    'cartao_cents',          v_cartao,
    'parcelas_maximas',      r.parcelas_maximas,
    'validado_em',           to_jsonb(now())
  ));
  new.modalidade     := 'sem_juros';
  new.fee_percentage := 0;   -- sem taxa de PIX nesta modalidade
  new.fee_amount     := 0;
  return new;
end;
$$;

drop trigger if exists trg_charges_definir_modalidade on public.charges;
create trigger trg_charges_definir_modalidade
  before insert or update of modalidade on public.charges
  for each row execute function public.charges_definir_modalidade();
