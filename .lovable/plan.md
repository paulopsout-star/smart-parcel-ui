
# Diagnóstico: Plataforma Salva Sessão Expirada e Não Solicita Login

## O Problema Real (3 causas identificadas)

### Causa 1 — getSession() retorna sessão inválida do localStorage (principal)

Os logs do Supabase mostram claramente o padrão:

```
session id (ab937b72-03cf-404e-800c-2668efa1bb92) doesn't exist → 403
```

O que acontece na prática:
1. O usuário faz logout ou a sessão expira no servidor
2. O token continua salvo no `localStorage` do browser
3. Na próxima visita, `supabase.auth.getSession()` lê o token do `localStorage` — sem validar com o servidor — e retorna `session != null`
4. O `AuthContext` define `user = session.user` com base nesse dado local corrompido
5. A `ProtectedRoute` vê `user != null` e **deixa o usuário entrar sem fazer login**
6. Quando qualquer chamada real ao Supabase é feita, vem 403 "Session not found"

O `getSession()` do SDK do Supabase retorna o que está no `localStorage` diretamente, sem round-trip ao servidor. É comportamento documentado — mas está sendo usado incorretamente aqui como "prova de autenticação válida".

### Causa 2 — Dupla inicialização no AuthContext (race condition)

O `AuthContext` inicia a sessão **duas vezes**:

```typescript
// Listener 1: onAuthStateChange (correto)
supabase.auth.onAuthStateChange(async (event, session) => { ... })

// Listener 2: getSession() manual — lê localStorage SEM validar
supabase.auth.getSession().then(({ data: { session } }) => { ... })
```

Isso cria uma race condition: o `getSession()` retorna primeiro (leitura local imediata) e seta `user` e `loading=false` antes do `onAuthStateChange` confirmar com o servidor. Se a sessão for inválida, o `onAuthStateChange` vai disparar `SIGNED_OUT` depois — mas aí a página já foi exibida.

### Causa 3 — signOut não limpa o token corretamente em todos os cenários

O `signOut` atual só remove a chave `sb-*-auth-token`. Mas o Supabase JS v2 pode armazenar dados com chaves diferentes dependendo da versão e configuração. Existe o risco de o token persistir com uma chave ligeiramente diferente.

Adicionalmente, o `useSessionTimeout` só limpa `sb-*-auth-token`, mas se o SDK armazenar dados adicionais (como `sb-*-auth-token-code-verifier`), esses ficam no localStorage.

---

## Evidências dos Logs

```
[14:30:48] GET /user → 403 session_not_found (IP: 18.228.9.133)
[14:30:49] GET /user → 403 session_not_found (IP: 18.231.159.95)
[14:27:54] POST /logout → 204 (usuário: KSL - Associados)
```

O usuário KSL fez logout às 14:27. Às 14:30 (3 minutos depois) duas requests chegaram com a **mesma sessão inválida** `ab937b72`. Isso confirma que o token ficou no localStorage mesmo após o logout, e o frontend tentou usá-lo como válido.

---

## Solução

### 1. Corrigir `AuthContext.tsx` — validar sessão com o servidor

Remover o `getSession()` manual e deixar **apenas o `onAuthStateChange`** como fonte de verdade. Adicionalmente, quando o evento recebido for `SIGNED_OUT` ou a sessão for nula, limpar o localStorage imediatamente.

```typescript
useEffect(() => {
  // ÚNICO ponto de inicialização: onAuthStateChange
  // Isso inclui o estado inicial (dispara com o token do localStorage SE válido)
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      console.log('[AuthContext] event:', event);
      
      if (event === 'SIGNED_OUT' || !session) {
        // Limpar localStorage completamente
        Object.keys(localStorage)
          .filter(k => k.startsWith('sb-'))
          .forEach(k => localStorage.removeItem(k));
        setUser(null);
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setSession(session);
        setUser(session.user);
        // Fetch profile sem setTimeout — não há risco aqui pois já temos sessão válida
        const userProfile = await fetchProfile(session.user.id);
        setProfile(userProfile);
        setLoading(false);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

A chave aqui: o `onAuthStateChange` com evento `INITIAL_SESSION` **já valida o token com o servidor** antes de disparar. Se o token for inválido, ele dispara `SIGNED_OUT` automaticamente — sem precisar do `getSession()` manual.

### 2. Corrigir `signOut` — limpar TODO o localStorage do Supabase

```typescript
const signOut = async () => {
  // Limpar localStorage ANTES do signOut (evita race condition)
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => localStorage.removeItem(k));

  const { error } = await supabase.auth.signOut();

  setUser(null);
  setSession(null);
  setProfile(null);

  return { error };
};
```

### 3. Corrigir `useSessionTimeout.ts` — limpar localStorage completamente

A versão atual só remove `sb-*-auth-token`. Corrigir para remover **todos** os itens `sb-*`:

```typescript
const forceLocalLogout = useCallback(async () => {
  // Limpar TODOS os dados do Supabase no localStorage
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => localStorage.removeItem(k));

  try {
    await signOut();
  } catch (e) {
    console.warn('[SessionTimeout] signOut falhou:', e);
  }

  toast({ title: "Sessão expirada", description: "Você foi desconectado por inatividade." });
  window.location.href = '/login';
}, [signOut]);
```

---

## Arquivos Afetados

- `src/contexts/AuthContext.tsx` — remoção do `getSession()` manual, adição de tratamento por evento
- `src/hooks/useSessionTimeout.ts` — limpeza completa do localStorage

## O que NÃO muda

- Nenhuma Edge Function alterada
- Nenhum banco de dados alterado
- Nenhuma tela/UI alterada
- Comportamento de login permanece idêntico para o usuário
- Roles continuam sendo lidas da tabela `user_roles`

## Resultado Esperado

- Sessão inválida/expirada no servidor → usuário é redirecionado para `/login` imediatamente ao abrir a plataforma
- Logout limpa completamente o estado local
- Timeout de inatividade (5 min) remove todos os dados de sessão corretamente
- Sem "fantasmas" de sessão no localStorage após desconexão
