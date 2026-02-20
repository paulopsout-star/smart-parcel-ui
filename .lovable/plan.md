

# Otimizacoes de Performance -- Fase 2

As correcoes da Fase 1 (Promise.all no fetchProfile, .limit(100), remocao do getSession()) ja foram aplicadas. Porem, os clientes continuam reclamando de lentidao. A analise revela **5 gargalos adicionais** que se acumulam.

---

## Problemas Identificados

### 1. Console.log em CADA render do AuthContext (impacto em toda a plataforma)

Na linha 172 do `AuthContext.tsx`, existe um `console.log` que executa em **todo render** de qualquer componente que use `useAuth()`. Isso significa centenas de chamadas por sessao, poluindo console e causando micro-atrasos.

```typescript
// Executa em CADA render de QUALQUER componente com useAuth()
console.log('🔍 [AuthContext Render] Estado atual:', { ... });
```

**Correcao:** Remover esse log de debug (ou envolver em `if (import.meta.env.DEV)`).

### 2. Dashboard faz `select('*')` em charges sem colunas especificas

O Dashboard carrega `select('*')` para calcular estatisticas, trazendo TODAS as colunas de charges (incluindo metadata, boleto_linha_digitavel, etc.) quando so precisa de `id, status, amount, created_at`. Payload desnecessariamente grande.

```typescript
// Atual - traz tudo
.select('*')

// Otimizado - traz so o necessario
.select('id, status, amount, created_at')
```

**Correcao:** Substituir `select('*')` por `select('id, status, amount, created_at')` no Dashboard.

### 3. ChargeHistory: `fetchCharges` com `select('*')` + JOINs pesados

A query principal do Historico traz `select('*', ...)` com JOINs em `companies`, `charge_executions` e `payment_splits`. O `*` carrega todas as 30+ colunas de charges quando a tabela principal so precisa de ~15 para a UI.

**Correcao:** Substituir `select('*', ...)` por colunas especificas.

### 4. Sincronizacao automatica dispara 2s apos carregar + a cada 5 min

Apos `fetchCharges`, o segundo `useEffect` agenda uma sincronizacao em 2 segundos, invocando **3 Edge Functions em paralelo** (`sync-payment-status`, `sync-mercadopago-status`, `sync-card-status`). Isso compete com o carregamento inicial, causando lentidao percebida.

**Correcao:** Aumentar o delay inicial de 2s para 10s, dando tempo para a UI estabilizar antes de iniciar sincronizacao em background.

### 5. `useEffect` com dependencia `[isAdmin]` re-executa fetchCharges

O useEffect principal depende de `[isAdmin]`, que muda de `undefined` para `true/false` quando o profile carrega. Isso pode causar dupla execucao do `fetchCharges` (uma com isAdmin=false, outra com isAdmin=true).

**Correcao:** Substituir a dependencia `[isAdmin]` por `[profile?.company_id]` -- isso garante que fetchCharges execute uma unica vez quando o profile esta pronto.

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/contexts/AuthContext.tsx` | Remover console.log de render |
| `src/pages/Dashboard.tsx` | Substituir `select('*')` por colunas minimas |
| `src/pages/ChargeHistory.tsx` | Substituir `select('*')` por colunas especificas; mudar dep de useEffect; aumentar delay da sync inicial |

## O que NAO muda

- Nenhuma Edge Function alterada
- Nenhum layout/UI/componente alterado
- Nenhum contrato de integracao modificado
- Funcionalidades de filtro, exportacao e sincronizacao preservadas
- RLS policies inalteradas

## Resultado Esperado

- Eliminacao de logs de debug que poluem cada render (~centenas por sessao)
- Payload do Dashboard reduzido em ~70% (de 30+ colunas para 4)
- Payload do ChargeHistory reduzido em ~40% (colunas especificas)
- Carregamento inicial sem competir com sync automatica (delay de 10s)
- fetchCharges executa apenas 1 vez no mount (nao 2x)

