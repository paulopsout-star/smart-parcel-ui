-- profiles não tinha política de UPDATE (a antiga "Admins can update all profiles" foi removida em uma
-- migração anterior). Resultado: os switches "Ativo" e "Sem juros" da tela de Usuários afetavam 0 linhas
-- em silêncio. Só administradores podem alterar perfis; o parâmetro sem juros continua protegido pelo
-- gatilho trg_protect_sem_juros_habilitado.

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
  on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
