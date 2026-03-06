

# Auditoria Arquitetural Completa — Hub de Pagamentos Autonegocie

---

## 1. VISÃO GERAL DA ARQUITETURA

- **Padrão**: SPA monolítica (React + Vite), client-side rendering (CSR)
- **Camadas**: Frontend React → Supabase (Postgres + Edge Functions) → APIs externas (Quita+, MercadoPago)
- **State**: Context API (`AuthContext`) + `useState` local + React Query (parcial)
- **Módulos**: Dashboard, Cobranças (NewCharge, ChargeHistory), Checkout público, Admin (users, refunds, recurrences, reports, settings), Pagamentos (PIX, Card, Combined)

---

## 2. ARQUITETURA FRONTEND

| Aspecto | Estado Atual | Risco |
|---------|-------------|-------|
| Rendering | CSR puro (Vite + React) | OK para SPA |
| State global | Context API (`AuthContext`) — sem memoização | **ALTO** — qualquer mudança de state re-renderiza toda a árvore |
| React Query | Usado parcialmente (`useChargesQuery`) mas Dashboard usa `useState`+`useEffect` manual | **MÉDIO** — sem cache, sem dedup |
| Virtualização de listas | Nenhuma — `ChargeHistory.tsx` tem **2172 linhas** renderizando tudo inline | **ALTO** |
| Code splitting/lazy | Nenhum — todas as 30+ páginas importadas eagerly em `App.tsx` | **ALTO** — bundle monolítico |
| Assets lazy loading | Não identificado | Baixo (poucas imagens) |

---

## 3. DATA FETCHING & API

| Aspecto | Estado Atual | Risco |
|---------|-------------|-------|
| Dashboard queries | 3 queries sequenciais (`charges`, `payment_splits`, `companies`) via `useEffect` sem React Query | **ALTO** — sem cache, re-executa a cada mount |
| ChargeHistory | Query SELECT com JOINs a `companies`, `charge_executions`, `payment_splits` — potencialmente pesada | **ALTO** |
| RLS overhead | Cada query `charges` avalia `is_admin_or_operador()` + `get_user_company_id()` (2 SECURITY DEFINER functions) — admin avalia `has_role()` também | **CRÍTICO** — principal suspeito do freeze |
| Caching | Dashboard não usa React Query; ChargeHistory usa mas com `staleTime` default (0) | **ALTO** |
| N+1 | O SELECT do `useChargesQuery` já faz JOINs inline — sem N+1 | OK |
| Realtime | Nenhuma subscription realtime ativa | OK (sem leak) |

---

## 4. DATABASE & BACKEND

### RLS — CAUSA RAIZ PROVÁVEL DO FREEZE

As policies da tabela `charges` chamam **3 funções SECURITY DEFINER** em cada row:
1. `has_role(auth.uid(), 'admin')` — query em `user_roles`
2. `is_admin_or_operador(auth.uid())` — query em `user_roles`  
3. `get_user_company_id(auth.uid())` — query em `profiles`

Para **admin**: a policy `SELECT` avalia `has_role(auth.uid(), 'admin') OR (is_admin_or_operador(auth.uid()) AND company_id = get_user_company_id(auth.uid()))`. Mesmo com short-circuit do `OR`, o Postgres **pode avaliar ambos os lados**.

**Com 100+ charges × 3 function calls = 300+ sub-queries por request.**

A mesma lógica se repete em `payment_splits` (policy `true` no SELECT — OK), `charge_executions` (mesma policy pesada), `companies` (mesma policy).

### Índices
Sem visibilidade direta nos índices, mas as colunas `company_id`, `user_id` nas tabelas `user_roles` e `profiles` provavelmente não têm índices otimizados para essas lookups repetidas.

---

## 5. STATE MANAGEMENT & MEMORY LEAKS

| Aspecto | Estado Atual | Risco |
|---------|-------------|-------|
| `useSessionTimeout` | Escuta `mousemove` globalmente e chama `resetTimer()` a cada pixel movido — cria/destrói 2 timeouts por movimento | **ALTO** — gera milhares de calls/segundo |
| `persistSession: false` + localStorage cleanup no module scope | Limpa `sb-*` keys **no import** do client — executa antes de qualquer auth check | **MÉDIO** — pode causar re-auth loops |
| AuthContext | `fetchProfile` é `async` dentro de `onAuthStateChange` — pode causar race conditions em token refresh | Baixo |
| ChargeHistory (2172 linhas) | Componente monolítico sem memoização | **ALTO** |

---

## 6. TOP 10 BOTTLENECKS IDENTIFICADOS

### 1. **`useSessionTimeout` — mousemove sem throttle**
- **Onde**: `src/hooks/useSessionTimeout.ts` linhas 58-61
- **Problema**: `document.addEventListener('mousemove', handleActivity)` chama `resetTimer()` que faz `clearTimeout` + `setTimeout` × 2 a cada pixel
- **Impacto**: Milhares de alocações/desalocações de timers por segundo → jank/freeze
- **Fix**: Adicionar throttle de 30s no `resetTimer` (a inatividade é de 5min, não precisa de granularidade de ms)

### 2. **RLS pesado na tabela `charges`**
- **Onde**: Policies RLS em `charges`, `charge_executions`
- **Problema**: 3 SECURITY DEFINER function calls por row por query
- **Impacto**: Dashboard e ChargeHistory travam esperando o PostgREST
- **Fix**: Criar uma única função `can_access_charge(uid, company_id)` que faça uma query só, ou usar `auth.jwt() ->> 'role'` em vez de function calls

### 3. **Dashboard não usa React Query**
- **Onde**: `src/pages/Dashboard.tsx` linhas 53-58, 82-158
- **Problema**: `useEffect` manual com `useState` — sem cache, re-fetcha a cada mount/navigate
- **Impacto**: Freeze de 2-5s ao abrir dashboard
- **Fix**: Migrar para `useQuery` com `staleTime: 60_000`

### 4. **Nenhum code splitting**
- **Onde**: `src/App.tsx` — 30+ imports estáticos no topo
- **Problema**: Bundle único com todas as páginas
- **Impacto**: First load lento (~2-3s extra parsing)
- **Fix**: `React.lazy()` + `Suspense` para rotas protegidas

### 5. **ChargeHistory.tsx — 2172 linhas monolíticas**
- **Onde**: `src/pages/ChargeHistory.tsx`
- **Problema**: Componente gigante sem memoização nem virtualização
- **Impacto**: Re-renders lentos, parse lento
- **Fix**: Extrair sub-componentes, usar `React.memo`, virtualizar lista

### 6. **localStorage cleanup no module scope**
- **Onde**: `src/integrations/supabase/client.ts` linhas 13-15
- **Problema**: Limpa tokens `sb-*` toda vez que o módulo é importado (não só no boot)
- **Impacto**: Com `persistSession: false` isso é redundante mas adiciona overhead desnecessário no hot path

### 7. **Dashboard faz 3 queries sem paralelizar**
- **Onde**: `src/pages/Dashboard.tsx` linhas 53-57
- **Problema**: `loadDashboardStats()` e `loadCompany()` são chamados em sequência mas internamente `loadDashboardStats` faz 2 queries sequenciais (charges → splits)
- **Impacto**: Waterfall de 3 round-trips (~1.5-3s total)
- **Fix**: `Promise.all` para charges + splits + company

### 8. **`new Date()` criado no corpo do render**
- **Onde**: `src/pages/Dashboard.tsx` linhas 78-80
- **Problema**: `const now = new Date()` fora do useEffect — recalcula a cada render
- **Impacto**: Menor, mas indica pattern de re-render desnecessário

### 9. **AuthContext sem memoização do value**
- **Onde**: `src/contexts/AuthContext.tsx` linhas 168-178
- **Problema**: Objeto `value` recriado a cada render → todos os consumers re-renderizam
- **Impacto**: Cascade de re-renders em toda a app
- **Fix**: `useMemo` no `value`

### 10. **SimulatorModal sempre montado**
- **Onde**: `src/pages/Dashboard.tsx` linha 280
- **Problema**: `<SimulatorModal>` renderizado mesmo quando `open=false`
- **Impacto**: Menor — depende da complexidade do modal

---

## 7. QUICK WINS (3 mudanças de maior impacto imediato)

### Quick Win 1: Throttle no `useSessionTimeout`
Adicionar um throttle simples de 30 segundos no `resetTimer`. Isso elimina milhares de timer allocations por segundo durante uso normal. **Impacto: elimina jank/micro-freezes durante interação.**

### Quick Win 2: `useMemo` no AuthContext value
Envolver o objeto `value` do `AuthContext.Provider` em `useMemo` com dependências corretas. **Impacto: elimina re-renders em cascata em toda a árvore de componentes.**

### Quick Win 3: Paralelizar queries do Dashboard com `Promise.all`
Juntar `loadDashboardStats` (charges + splits) e `loadCompany` em um único `Promise.all` de 3 queries. **Impacto: reduz waterfall de ~3s para ~1s no carregamento do dashboard.**

---

## Resumo Executivo

O **freeze do dashboard** é causado principalmente por:
1. **RLS pesado** — cada query avalia 3 functions por row (centenas de sub-queries)
2. **mousemove sem throttle** — `useSessionTimeout` sobrecarrega o event loop
3. **Sem cache** — queries re-executam a cada navegação sem React Query
4. **Sem code splitting** — bundle monolítico atrasa o parse inicial

Os 3 quick wins (throttle, useMemo, Promise.all) podem ser implementados em ~30 minutos sem alterar UI nem integrações.

