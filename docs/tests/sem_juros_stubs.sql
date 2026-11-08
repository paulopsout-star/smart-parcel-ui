create schema if not exists auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create type public.app_role as enum ('admin','operador');
create table public.user_roles (user_id uuid, role public.app_role);
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create table public.profiles (id uuid primary key, company_id uuid, full_name text, is_active boolean default true, updated_at timestamptz default now());
create table public.charges (id uuid primary key default gen_random_uuid(), company_id uuid, created_by uuid, amount integer not null, payment_method text default 'cartao', installments integer default 1, fee_amount integer default 0, fee_percentage numeric default 0, pix_amount integer, card_amount integer, metadata jsonb default '{}'::jsonb, status text default 'pending');
create role anon nologin; create role authenticated nologin; create role service_role nologin;
