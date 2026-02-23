

# Correcao: Botao "Criando..." travado na Nova Cobranca

## Causa Raiz

Dois gargalos identificados que se acumulam:

### 1. useCompanySettings chama getSession() DUAS vezes por fetch

O hook `useCompanySettings` (linhas 23 e 47) chama `supabase.auth.getSession()` em cada execucao da query. Este e o MESMO problema que corrigimos no AuthContext na Fase 1. Cada chamada custa 500ms-2s, totalizando 1-4s de atraso so para carregar configuracoes da empresa. Se o settings nao carrega rapido, o formulario pode nao estar pronto quando o usuario clica "Criar".

### 2. charge-links edge function sem timeout

Apos inserir a cobranca no banco com sucesso, o front chama `supabase.functions.invoke('charge-links')` na linha 400. Esta chamada:
- Nao tem timeout (pode levar 30+ segundos em cold start)
- O `setIsLoading(false)` so executa no `finally`, apos a Promise resolver
- O usuario ve "Criando..." sem saber se esta progredindo ou travou

---

## Solucao Proposta

### Arquivo 1: `src/hooks/useCompanySettings.ts`

Remover as duas chamadas a `getSession()` e usar o token que ja esta disponivel no cliente Supabase (gerenciado pelo AuthContext). O Supabase client JS ja inclui o token automaticamente em `functions.invoke`.

**Antes (linhas 19-101):**
- Linha 23: `await supabase.auth.getSession()` (1a chamada desnecessaria)
- Linhas 26-43: Logica de refresh manual
- Linha 47: `await supabase.auth.getSession()` (2a chamada desnecessaria)
- Linhas 48-54: Extracao manual do token

**Depois:**
- Remover TODA a logica de getSession/refreshSession
- Chamar `supabase.functions.invoke('company-settings')` diretamente (o client ja gerencia o token)
- Manter retry com invalidateQueries em caso de 401
- Resultado: eliminacao de ~4s de latencia no carregamento do formulario

### Arquivo 2: `src/pages/NewCharge.tsx`

Adicionar timeout de 15 segundos na chamada `charge-links` usando `AbortController`, e melhorar o feedback ao usuario.

**Mudancas:**
- Envolver a chamada `supabase.functions.invoke('charge-links')` em uma Promise.race com timeout de 15s
- Se timeout: mostrar toast informando que a cobranca foi criada mas o link sera gerado depois, e redirecionar para `/charges`
- Adicionar texto de progresso variavel no botao: "Criando cobranca..." -> "Gerando link..."

---

## O que NAO muda

- Nenhuma Edge Function alterada (charge-links, company-settings etc.)
- Nenhum layout/UI alterado (cores, posicoes, tamanhos)
- Nenhum contrato de integracao modificado
- RLS policies inalteradas
- Fluxo funcional preservado (inserir charge -> gerar link -> mostrar modal)

## Resultado Esperado

- Formulario de cobranca carrega 2-4s mais rapido (sem getSession duplo)
- Botao "Criando..." nunca fica preso por mais de 15s
- Usuario recebe feedback claro do progresso
- Se o link demorar, a cobranca ja esta salva e o link pode ser gerado depois pelo historico

