# Testes SQL da modalidade sem juros

Rodam em um Postgres descartável (Docker), sem tocar em produção:

```bash
docker run -d --name pgtest -e POSTGRES_PASSWORD=pg postgres:15-alpine
docker cp docs/tests/sem_juros_stubs.sql pgtest:/stubs.sql
docker cp supabase/migrations/20261107180000_sem_juros_modalidade.sql pgtest:/mig.sql
docker cp docs/tests/sem_juros_modalidade.test.sql pgtest:/tests.sql
docker exec pgtest psql -U postgres -v ON_ERROR_STOP=1 -q -f /stubs.sql -f /mig.sql
docker exec pgtest psql -U postgres -q -f /tests.sql 2>&1 | grep -E "OK|FALHOU"
docker rm -f pgtest
```

`sem_juros_stubs.sql` recria o mínimo do schema de produção (auth.uid, app_role, has_role, profiles, charges).
Os casos T01/T01b comparam `public.sem_juros_regras` com `src/lib/sem-juros.ts` (valores gerados pelo TS);
booleanos saem como `t`/`f` no psql.
