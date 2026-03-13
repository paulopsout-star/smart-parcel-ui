

# Plano de Otimização de Performance — Histórico de Cobranças

## Diagnóstico atual

A query em `fetchCharges()` (linha 940) busca **100 registros** com 3 JOINs (companies, charge_executions, payment_splits) **sem filtro de data no banco**. Todos os filtros (status, data, documento, empresa) são aplicados **no frontend** após carregar tudo. Não há paginação real, nem cache via React Query, nem índice composto.

## Plano de correção

### 1. Índice composto no banco (migração SQL)

```sql
CREATE INDEX IF NOT EXISTS idx_charges_company_created 
  ON public.charges (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_charges_created_at_desc 
  ON public.charges (created_at DESC);
```

Esses índices aceleram tanto a query filtrada por empresa (operador) quanto a query do admin (todas as empresas), ambas ordenadas por `created_at DESC`.

### 2. Filtro de data no banco (server-side)

Alterar `fetchCharges()` para enviar `date_from` e `date_to` como parâmetros `.gte()` / `.lte()` diretamente na query Supabase, ao invés de filtrar no frontend. Por padrão, carregar apenas o **mês corrente** (primeiro dia do mês até agora).

### 3. Paginação real com "Carregar mais"

- Implementar paginação por offset com `PAGE_SIZE = 50`.
- Estado: `page`, `hasMore`, `loadingMore`.
- Botão "Carregar mais" ao final da lista.
- Query: `.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)`.
- Contagem separada com `select('id', { count: 'exact', head: true })` para exibir total sem trazer dados.

### 4. React Query com staleTime

Substituir o `useState` + `useEffect` manual por `useQuery` do TanStack:
- `queryKey`: `['charges', { dateFrom, dateTo, status, paymentMethod, companyId, page }]`
- `staleTime: 60_000` (60s — evita refetch ao trocar aba)
- `keepPreviousData: true` (mostra dados anteriores enquanto carrega nova página)
- Remover `fetchCharges()` manual e os estados `loading`/`charges`/`filteredCharges`.

### 5. Skeleton loading melhorado

O skeleton atual já existe (linhas 1694+), mas será aprimorado para cobrir o estado de "carregar mais" também — um skeleton menor (3 linhas) aparece no final da tabela durante paginação.

### 6. Filtros server-side

Mover **todos** os filtros para a query Supabase:
- `status` → `.eq('status', value)`
- `payment_method` → `.eq('payment_method', value)`
- `date_from/date_to` → `.gte('created_at', ...)` / `.lte('created_at', ...)`
- `payer_document` → `.ilike('payer_document', '%value%')`
- `company_id` → `.eq('company_id', value)`

Remover `applyFilters()` e `filteredCharges` — tudo vem filtrado do banco.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/ChargeHistory.tsx` | Refatorar para React Query, paginação, filtros server-side, skeleton |
| Migração SQL | Criar índices compostos |

## O que NÃO muda

- Layout, cores, componentes visuais (mesma tabela, mesmos badges)
- Edge functions e integrações
- Lógica de sincronização automática (`syncPaymentStatuses`)
- Lógica de export CSV/Excel (opera sobre dados já carregados)
- Sheet de detalhes da cobrança

## Resultado esperado

- Carregamento inicial < 500ms (50 registros com índice + filtro de data)
- Skeleton visível durante loading
- Sem refetch ao trocar aba (staleTime 60s)
- Paginação real — "Carregar mais" para ver registros anteriores
- Filtros executados no banco, não no frontend

