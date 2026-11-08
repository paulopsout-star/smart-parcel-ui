\pset format unaligned
\pset tuples_only on
-- Dados de apoio
insert into public.user_roles values ('11111111-1111-1111-1111-111111111111','admin'), ('22222222-2222-2222-2222-222222222222','operador'), ('33333333-3333-3333-3333-333333333333','operador');
insert into public.profiles (id, full_name) values ('11111111-1111-1111-1111-111111111111','Admin'), ('22222222-2222-2222-2222-222222222222','Operador habilitado'), ('33333333-3333-3333-3333-333333333333','Operador comum');

-- 1. Regras SQL x TS (valores esperados do TypeScript)
select 'T01 regras ' || case when (select string_agg(concat_ws(',', elegivel, parcelas_maximas, desconto_cents, desconto_retido_cents, total_cliente_cents, abatimento_cents), ';' order by d) 
  from (values (100000,80000),(100000,75000),(100000,73000),(100000,70000),(100000,65000),(100000,60000),(100000,81000),(333333,233333)) v(d,a), lateral public.sem_juros_regras(v.d, v.a))
  = 'true,3,20000,20000,100000,0;true,6,25000,25000,100000,0;true,9,27000,27000,100000,0;true,12,30000,30000,100000,0;true,12,35000,35000,100000,0;true,12,40000,35000,95000,5000;false,0,19000,19000,100000,0;true,12,100000,100000,333333,0'
  then 'OK' else 'FALHOU: ' || (select string_agg(concat_ws(',', elegivel, parcelas_maximas, desconto_cents, desconto_retido_cents, total_cliente_cents, abatimento_cents), ';' order by d) from (values (100000,80000),(100000,75000),(100000,73000),(100000,70000),(100000,65000),(100000,60000),(100000,81000),(333333,233333)) v(d,a), lateral public.sem_juros_regras(v.d, v.a)) end;

-- Nota: a ordem do string_agg acima é por d (empate em 100000) — verificação robusta abaixo por caso
select 'T01b caso ' || d || '/' || a || ' ' || case when concat_ws(',', r.elegivel, r.parcelas_maximas, r.desconto_retido_cents, r.total_cliente_cents, r.abatimento_cents) = esperado then 'OK' else 'FALHOU ' || concat_ws(',', r.elegivel, r.parcelas_maximas, r.desconto_retido_cents, r.total_cliente_cents, r.abatimento_cents) end
from (values (100000,80000,'true,3,20000,100000,0'),(100000,75000,'true,6,25000,100000,0'),(100000,73000,'true,9,27000,100000,0'),(100000,70000,'true,12,30000,100000,0'),(100000,65000,'true,12,35000,100000,0'),(100000,60000,'true,12,35000,95000,5000'),(100000,81000,'false,0,19000,100000,0'),(333333,233333,'true,12,100000,333333,0')) v(d,a,esperado), lateral public.sem_juros_regras(v.d, v.a) r;

-- 2. Interruptor desligado: cobrança comum passa, com_juros
insert into public.charges (created_by, amount, payment_method, installments) values ('33333333-3333-3333-3333-333333333333', 10000, 'cartao', 3) returning 'T02 com_juros ' || case when modalidade='com_juros' then 'OK' else 'FALHOU' end;

-- 3. Interruptor desligado: cobrança sem juros é recusada
do $$ begin
  insert into public.charges (created_by, amount, payment_method, installments, metadata) values ('22222222-2222-2222-2222-222222222222', 100000, 'cartao', 3, '{"sem_juros":{"divida_cents":100000,"a_vista_cents":80000,"pix_cents":0}}');
  raise notice 'T03 FALHOU: aceitou com interruptor desligado';
exception when others then raise notice 'T03 OK (%): %', sqlerrm, ; end $$;

-- liga o interruptor (como service role: auth.uid() nulo)
update public.app_settings set value='true'::jsonb where key='sem_juros_ativo';
select 'T04 ativo ' || case when public.sem_juros_ativo() then 'OK' else 'FALHOU' end;

-- 4. Usuário não habilitado é recusado
do $$ begin
  insert into public.charges (created_by, amount, payment_method, installments, metadata) values ('33333333-3333-3333-3333-333333333333', 100000, 'cartao', 3, '{"sem_juros":{"divida_cents":100000,"a_vista_cents":80000,"pix_cents":0}}');
  raise notice 'T05 FALHOU: aceitou usuário não habilitado';
exception when others then raise notice 'T05 OK: %', sqlerrm; end $$;

-- habilita o operador 2 (service role)
update public.profiles set sem_juros_habilitado = true where id='22222222-2222-2222-2222-222222222222';

-- 5. Habilitado, válido: 3x em R$ 1.000 → sem_juros, fee 0, metadata normalizado
insert into public.charges (created_by, amount, payment_method, installments, fee_percentage, metadata) values ('22222222-2222-2222-2222-222222222222', 100000, 'cartao', 3, 1.5, '{"sem_juros":{"divida_cents":100000,"a_vista_cents":80000,"pix_cents":0,"parcelas_maximas":99}}')
returning 'T06 valido ' || case when modalidade='sem_juros' and fee_percentage=0 and (metadata->'sem_juros'->>'parcelas_maximas')='3' and (metadata->'sem_juros'->>'cartao_cents')='100000' then 'OK' else 'FALHOU ' || modalidade || ' ' || metadata::text end;

-- 6. Parcelas acima da faixa (4x com 20%)
do $$ begin
  insert into public.charges (created_by, amount, payment_method, installments, metadata) values ('22222222-2222-2222-2222-222222222222', 100000, 'cartao', 4, '{"sem_juros":{"divida_cents":100000,"a_vista_cents":80000,"pix_cents":0}}');
  raise notice 'T07 FALHOU: aceitou 4x';
exception when others then raise notice 'T07 OK: %', sqlerrm; end $$;

-- 7. Valor divergente da regra (tela mandou 95000 em vez de 100000)
do $$ begin
  insert into public.charges (created_by, amount, payment_method, installments, metadata) values ('22222222-2222-2222-2222-222222222222', 95000, 'cartao', 3, '{"sem_juros":{"divida_cents":100000,"a_vista_cents":80000,"pix_cents":0}}');
  raise notice 'T08 FALHOU: aceitou valor divergente';
exception when others then raise notice 'T08 OK: %', sqlerrm; end $$;

-- 8. Parcela mínima: R$ 100 em 6x (25%) → parcela 16,67 < 20
do $$ begin
  insert into public.charges (created_by, amount, payment_method, installments, metadata) values ('22222222-2222-2222-2222-222222222222', 10000, 'cartao', 6, '{"sem_juros":{"divida_cents":10000,"a_vista_cents":7500,"pix_cents":0}}');
  raise notice 'T09 FALHOU: aceitou parcela < 20';
exception when others then raise notice 'T09 OK: %', sqlerrm; end $$;

-- 9. Combinado válido: dívida 1000, à vista 600 (40%) → total 950, pix 150, cartão 800 em 12x (66,67 ≥ 20)
insert into public.charges (created_by, amount, payment_method, installments, pix_amount, card_amount, metadata) values ('22222222-2222-2222-2222-222222222222', 95000, 'cartao_pix', 12, 15000, 80000, '{"sem_juros":{"divida_cents":100000,"a_vista_cents":60000,"pix_cents":15000}}')
returning 'T10 combinado ' || case when modalidade='sem_juros' and (metadata->'sem_juros'->>'abatimento_cents')='5000' then 'OK' else 'FALHOU' end;

-- 10. Combinado com split divergente
do $$ begin
  insert into public.charges (created_by, amount, payment_method, installments, pix_amount, card_amount, metadata) values ('22222222-2222-2222-2222-222222222222', 95000, 'cartao_pix', 12, 10000, 85000, '{"sem_juros":{"divida_cents":100000,"a_vista_cents":60000,"pix_cents":15000}}');
  raise notice 'T11 FALHOU: aceitou split divergente';
exception when others then raise notice 'T11 OK: %', sqlerrm; end $$;

-- 11. Desconto < 20% com metadata sem_juros → recusado
do $$ begin
  insert into public.charges (created_by, amount, payment_method, installments, metadata) values ('22222222-2222-2222-2222-222222222222', 100000, 'cartao', 1, '{"sem_juros":{"divida_cents":100000,"a_vista_cents":81000,"pix_cents":0}}');
  raise notice 'T12 FALHOU: aceitou < 20%%';
exception when others then raise notice 'T12 OK: %', sqlerrm; end $$;

-- 12. Simulação obrigatória: habilitado, interruptor ligado, cartão, sem carimbo → recusado
do $$ begin
  insert into public.charges (created_by, amount, payment_method, installments) values ('22222222-2222-2222-2222-222222222222', 10000, 'cartao', 1);
  raise notice 'T13 FALHOU: aceitou sem simulação';
exception when others then raise notice 'T13 OK: %', sqlerrm; end $$;
-- com carimbo de simulação (caminho com juros) passa
insert into public.charges (created_by, amount, payment_method, installments, metadata) values ('22222222-2222-2222-2222-222222222222', 10000, 'cartao', 1, '{"simulacao":{"divida_cents":10000,"a_vista_cents":9000}}') returning 'T14 carimbo ' || case when modalidade='com_juros' then 'OK' else 'FALHOU' end;
-- PIX puro do habilitado passa sem simulação
insert into public.charges (created_by, amount, payment_method, installments) values ('22222222-2222-2222-2222-222222222222', 10000, 'pix', 1) returning 'T15 pix puro ' || case when modalidade='com_juros' then 'OK' else 'FALHOU' end;
-- usuário comum segue sem simulação
insert into public.charges (created_by, amount, payment_method, installments) values ('33333333-3333-3333-3333-333333333333', 10000, 'cartao', 1) returning 'T16 comum ' || case when modalidade='com_juros' then 'OK' else 'FALHOU' end;

-- 13. Modalidade imutável
do $$ begin
  update public.charges set modalidade='sem_juros' where modalidade='com_juros' and created_by='33333333-3333-3333-3333-333333333333';
  raise notice 'T17 FALHOU: alterou modalidade';
exception when others then raise notice 'T17 OK: %', sqlerrm; end $$;

-- 14. Proteção do parâmetro: operador comum tentando se habilitar
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
do $$ begin
  update public.profiles set sem_juros_habilitado = true where id='33333333-3333-3333-3333-333333333333';
  raise notice 'T18 FALHOU: operador se habilitou';
exception when others then raise notice 'T18 OK: %', sqlerrm; end $$;
reset role;
-- admin pode
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
update public.profiles set sem_juros_habilitado = true where id='33333333-3333-3333-3333-333333333333' returning 'T19 admin habilita OK';
-- função do front para o operador 3 agora habilitado
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select 'T20 sem_juros_habilitado() ' || case when public.sem_juros_habilitado() then 'OK' else 'FALHOU' end;
-- app_settings: operador não altera (RLS) — update silencioso afeta 0 linhas
update public.app_settings set value='false'::jsonb where key='sem_juros_ativo';
select 'T21 rls app_settings ' || case when public.sem_juros_ativo() then 'OK (operador não desligou)' else 'FALHOU' end;
reset role;
\pset format unaligned
\pset tuples_only on
-- T03 refeito: interruptor desligado recusa sem juros (mensagem)
update public.app_settings set value='false'::jsonb where key='sem_juros_ativo';
do $$ begin
  insert into public.charges (created_by, amount, payment_method, installments, metadata) values ('22222222-2222-2222-2222-222222222222', 100000, 'cartao', 3, '{"sem_juros":{"divida_cents":100000,"a_vista_cents":80000,"pix_cents":0}}');
  raise notice 'T03 FALHOU: aceitou com interruptor desligado';
exception when others then raise notice 'T03 OK: %', sqlerrm; end $$;
update public.app_settings set value='true'::jsonb where key='sem_juros_ativo';

-- Grants como em produção (baseline) para exercitar o gatilho e não a falta de privilégio
grant all on table public.profiles, public.charges, public.user_roles to authenticated;

-- T18 refeito: operador comum (auth.uid = 3) tenta se habilitar; bypass de RLS como postgres para testar SÓ o gatilho
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  update public.profiles set sem_juros_habilitado = true where id='33333333-3333-3333-3333-333333333333';
  raise notice 'T18 FALHOU: operador se habilitou';
exception when others then raise notice 'T18 OK: %', sqlerrm; end $$;
-- operador altera OUTRO campo do próprio perfil: gatilho não interfere
update public.profiles set full_name='Operador comum 2' where id='33333333-3333-3333-3333-333333333333' returning 'T18b outro campo OK';

-- T19: admin (auth.uid = 1) habilita o operador 3
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.profiles set sem_juros_habilitado = true where id='33333333-3333-3333-3333-333333333333' returning 'T19 admin habilita OK';

-- T20: função do front para o operador 3
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select 'T20 sem_juros_habilitado() ' || case when public.sem_juros_habilitado() then 'OK' else 'FALHOU' end;
-- e para o admin, que não está habilitado
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'T20b admin nao habilitado ' || case when not public.sem_juros_habilitado() then 'OK' else 'FALHOU' end;
-- interruptor desligado → função do front devolve false mesmo habilitado
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
update public.app_settings set value='false'::jsonb where key='sem_juros_ativo';
select 'T20c interruptor desligado ' || case when not public.sem_juros_habilitado() then 'OK' else 'FALHOU' end;
