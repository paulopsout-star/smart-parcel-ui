

# Corrigir Sessao Zumbi e Login Automatico Indevido

## Problema

Dois sintomas interligados com a mesma causa raiz:

1. **Login automatico indevido**: Apos o timeout de inatividade, o `signOut()` tenta fazer logout no servidor, mas a sessao ja foi invalidada (servidor retorna 403 "Session not found"). O token permanece no `localStorage`. Quando o usuario volta a pagina de login, o Supabase auto-refresh o token e a sessao "ressuscita", redirecionando automaticamente para o dashboard.

2. **"Configuracoes da empresa ausentes"**: A sessao esta em estado "zumbi" — token local existe, mas o servidor rejeita as requisicoes, causando falha ao buscar company settings.

## Causa raiz

- O `signOut()` do Supabase retorna erro 403 quando a sessao ja expirou no servidor, mas NAO limpa o `localStorage`
- Com `autoRefreshToken: true`, o refresh token no `localStorage` permite recriar a sessao automaticamente
- O `Login.tsx` redireciona para `/dashboard` se detectar `user`, e o AuthContext recria o `user` a partir do token local

## Solucao proposta (3 arquivos)

### 1. `src/hooks/useSessionTimeout.ts`

Garantir que o logout por inatividade SEMPRE limpe o estado local, mesmo se o servidor retornar erro:

```typescript
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
const WARNING_BEFORE = 1 * 60 * 1000;

export function useSessionTimeout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate(); // adicionar
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningRef = useRef<NodeJS.Timeout>();

  const forceLocalLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (e) {
      // signOut falhou (sessao ja expirada no servidor)
      // Limpar manualmente o estado local
      console.warn('[SessionTimeout] signOut falhou, limpando local:', e);
    }

    // SEMPRE limpar localStorage do Supabase, independente do resultado
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });

    toast({
      title: "Sessao expirada",
      description: "Voce foi desconectado por inatividade.",
    });

    // Forcar navegacao para login
    window.location.href = '/login';
  }, [signOut]);

  // ... resetTimer usa forceLocalLogout no timeout de 5min
}
```

### 2. `src/contexts/AuthContext.tsx`

Melhorar o `signOut` para sempre limpar o estado local:

```typescript
const signOut = async () => {
  const { error } = await supabase.auth.signOut();

  // Mesmo com erro (ex: 403 session not found), limpar estado local
  if (error) {
    console.warn('[AuthContext] signOut com erro, limpando estado local:', error.message);
    // Limpar tokens do localStorage manualmente
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
  }

  // Sempre limpar estado React
  setUser(null);
  setSession(null);
  setProfile(null);

  return { error };
};
```

### 3. `src/hooks/useCompanySettings.ts`

Quando detectar sessao invalida, forcar logout limpo em vez de apenas lancar erro:

```typescript
if (sessionError || !currentSession) {
  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

  if (refreshError || !refreshData.session) {
    // Limpar tokens locais para evitar sessao zumbi
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
    // Redirecionar para login
    window.location.href = '/login';
    throw new Error('Sessao expirada');
  }
}
```

## O que NAO muda

- Nenhum layout/design e alterado
- Nenhuma Edge Function e alterada
- Nenhum schema de banco e alterado
- O timeout de 5 minutos continua o mesmo
- A logica de RBAC/ProtectedRoute permanece intacta

## Resultado esperado

- Apos inatividade de 5 min, o usuario e desconectado de forma definitiva (sem "ressurreicao")
- Ao clicar em Login, nao ocorre login automatico — o formulario aparece normalmente
- O erro "Configuracoes da empresa ausentes" nao ocorre mais com sessoes zumbi

