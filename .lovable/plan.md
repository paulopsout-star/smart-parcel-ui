
# Diagnóstico: Lentidão no Carregamento do Histórico de Cobranças

## Causa Raiz (3 problemas encadeados)

### Problema 1 — Validação de sessão síncrona bloqueia o carregamento (principal)

Com `persistSession: false`, o Supabase não guarda o token localmente. A cada abertura ou refresh da página, o `onAuthStateChange` precisa aguardar o evento `INITIAL_SESSION`, que faz uma chamada de rede ao servidor Supabase para validar — isso pode levar **2 a 4 segundos** dependendo da latência.

Durante esse período:
- `loading = true` no `AuthContext`
- `ProtectedRoute` exibe um spinner sem contexto
- `ChargeHistory` ainda não iniciou o `fetchCharges()`
- O usuário vê tela em branco ou spinner por 2-4s, depois ainda espera mais 1-2s para carregar as cobranças

Total: até **6 segundos** de espera antes de ver qualquer dado.

### Problema 2 — `fetchCharges` só é chamado após `isAdmin` estar resolvido

```typescript
useEffect(() => {
  fetchCharges();    // Aguarda isAdmin estar disponível
  fetchCompanies();
}, [isAdmin]);       // ← Só dispara quando profile está carregado
```

Isso cria uma cascata sequencial:
1. Esperar `INITIAL_SESSION` do servidor (~2-4s)
2. Esperar `fetchProfile` (2 queries ao banco: profiles + user_roles)
3. Só então `fetchCharges` inicia

### Problema 3 — `getSession()` residual vai quebrar para admin

Em `handleAdminLinkBoleto` (linha 1191), existe:
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) { ... }
```

Com `persistSession: false`, `getSession()` sempre retornará `null`, impedindo que o admin vincule boletos manualmente. Este código precisa ser removido, pois a função `admin-link-boleto` já valida autenticação internamente via JWT.

## Solução

### 1. Adicionar um `loading` visual de tela inteira imediato (feedback instantâneo)

Enquanto o `AuthContext` valida a sessão, mostrar um skeleton ou splash com a logo da plataforma em vez de um spinner sem contexto. Isso não muda a velocidade real, mas elimina a percepção de "tela travada".

### 2. Paralelizar `fetchProfile` para reduzir latência

Em vez de fazer 2 queries sequenciais (primeiro `profiles`, depois `user_roles`), executar ambas em paralelo com `Promise.all`. Isso reduz o tempo de `fetchProfile` de ~800ms para ~400ms.

```typescript
// Antes (sequencial):
const profileData = await supabase.from('profiles').select(...)
const roleData = await supabase.from('user_roles').select(...)

// Depois (paralelo):
const [profileResult, roleResult] = await Promise.all([
  supabase.from('profiles').select(...),
  supabase.from('user_roles').select(...),
])
```

### 3. Remover o `getSession()` residual no `handleAdminLinkBoleto`

Remover as linhas 1191-1199 de `ChargeHistory.tsx` que chamam `getSession()`. A Edge Function `admin-link-boleto` já valida autenticação pelo JWT enviado automaticamente pelo cliente Supabase — essa verificação manual é redundante e vai quebrar com `persistSession: false`.

### 4. Adicionar paginação ou limite na query de cobranças

A query `fetchCharges` busca **todas** as cobranças sem limite. Para operadores com muitos registros, isso gera payloads grandes e lentidão na renderização. Adicionar limite inicial de 100 registros mais recentes com a possibilidade de carregar mais.

```typescript
.order('created_at', { ascending: false })
.limit(100)  // ← adicionar
```

## Arquivos Afetados

- `src/contexts/AuthContext.tsx` — paralelizar `fetchProfile` (Promise.all)
- `src/pages/ChargeHistory.tsx` — remover `getSession()` residual, adicionar `.limit(100)` na query

## O que NÃO muda

- Nenhuma Edge Function alterada
- Nenhuma lógica de negócio ou filtros alterados
- Layout e UI permanecem idênticos
- Funcionalidade de exportação CSV/Excel inalterada
- Sistema de sincronização automática inalterado

## Resultado Esperado

- `fetchProfile` reduzido de ~800ms para ~400ms (paralelização)
- Carregamento inicial de cobranças mais rápido (limite de 100 registros)
- Vinculação de boleto admin funciona corretamente (remoção do `getSession()` quebrado)
- Feedback visual imediato eliminando a percepção de "tela travada"
