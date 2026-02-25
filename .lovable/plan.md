

# Diagnóstico: "Link de Pagamento — Carregando..." fica travado

## Causa Raiz

O componente `CheckoutButtons` (linha 1272 de ChargeHistory.tsx) chama `getExistingLink(charge.id)` que internamente invoca a Edge Function `charge-links` com `action: 'get'`. Essa chamada **não tem timeout** — se a Edge Function demorar (cold start de 5-15s, ou falhar silenciosamente), o estado `isLoading` permanece `true` indefinidamente, exibindo "Carregando..." para sempre.

Adicionalmente, o `tried` Set module-level impede re-tentativas automáticas: uma vez que o chargeId entra no Set (linha 35), a query fica com `enabled: false` e nunca mais roda, mesmo que tenha falhado.

Fluxo problemático:
```text
CheckoutButtons monta
  → getExistingLink(chargeId) com enabled=true
    → queryFn dispara
      → tried.add(chargeId) ← marca ANTES de ter resultado
      → supabase.functions.invoke('charge-links') ← SEM TIMEOUT
        → Edge Function cold start (5-15s)
        → Ou erro de rede/auth silencioso
      → isLoading=true indefinidamente
```

## Plano de Correção

### Arquivo: `src/hooks/useChargeLinks.ts` — função `getExistingLink`

**Mudança 1: Adicionar timeout de 15 segundos na queryFn**

Envolver a chamada à Edge Function em `Promise.race` com timeout de 15 segundos. Se estourar, retornar `null` (link não disponível) em vez de ficar pendente para sempre. Isso faz o componente sair do estado "Carregando..." e mostrar o botão "Gerar Link" ou "Tentar Novamente".

**Mudança 2: Mover `tried.add()` para DEPOIS do resultado**

Atualmente `tried.add(chargeId)` é chamado no início da queryFn (linha 35), antes de ter o resultado. Se a query falhar, o chargeId já está no Set e `enabled` vira `false`, impedindo qualquer re-tentativa. Mover o `tried.add()` para depois do retorno bem-sucedido.

**Mudança 3: Tratar erro sem travar**

No `catch` do timeout ou erro de rede, retornar `null` em vez de lançar exceção. Isso evita que o React Query entre em estado de erro com retry, e permite ao usuário clicar em "Tentar Novamente" manualmente.

### Arquivo: `src/pages/ChargeHistory.tsx` — componente `CheckoutButtons`

**Mudança 4: Tratar estado de erro do linkQuery**

Adicionar tratamento para `linkQuery.isError` mostrando mensagem "Erro ao carregar link" com botão "Tentar Novamente", em vez de ficar eternamente em loading.

## O que NÃO muda

- Layout/UI do componente (cores, posições, tamanhos)
- Edge Function `charge-links` (nenhuma alteração no backend)
- Lógica de geração de link (`generateLinkMutation`)
- Fluxo funcional (buscar DB → buscar edge → salvar)

## Resultado Esperado

- "Carregando..." nunca dura mais de 15 segundos
- Após timeout, o usuário vê "Link indisponível" com botão para tentar novamente
- O botão "Tentar Novamente" funciona corretamente (sem bloqueio pelo Set `tried`)

