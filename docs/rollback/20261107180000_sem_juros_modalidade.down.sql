-- Reversão completa da migração 20261107180000_sem_juros_modalidade.sql
--
-- Antes de rodar isto, o caminho rápido é só DESLIGAR o interruptor:
--   update public.app_settings set value = 'false'::jsonb, updated_at = now() where key = 'sem_juros_ativo';
-- Com ele desligado, nenhuma cobrança nova nasce sem juros e o gatilho só marca 'com_juros'.
--
-- A remoção abaixo apaga gatilhos, funções, interruptor e índice. As colunas são mantidas por
-- padrão (são aditivas e inofensivas); descomente o bloco final para removê-las também.

drop trigger if exists trg_charges_definir_modalidade on public.charges;
drop function if exists public.charges_definir_modalidade();

drop trigger if exists trg_protect_sem_juros_habilitado on public.profiles;
drop function if exists public.protect_sem_juros_habilitado();

drop function if exists public.sem_juros_habilitado();
drop function if exists public.sem_juros_regras(integer, integer);
drop function if exists public.sem_juros_ativo();

drop index if exists public.idx_charges_modalidade_sem_juros;

drop table if exists public.app_settings;

-- Opcional: remover as colunas (perde a marcação das cobranças já criadas sem juros)
-- alter table public.charges drop constraint if exists charges_modalidade_check;
-- alter table public.charges drop column if exists modalidade;
-- alter table public.profiles drop column if exists sem_juros_habilitado;
