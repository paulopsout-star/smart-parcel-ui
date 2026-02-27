

# Diagnóstico de Infraestrutura e Lógica — Criação de Cobrança

## Investigação realizada

1. **Postgres**: Zero erros (ERROR/FATAL/PANIC) nos logs recentes. Sem queries travadas (`pg_stat_activity` limpa). Rollback rate normal (20k rollbacks vs 3.2M commits).
2. **Edge Function `charge-links`**: Sem logs recentes — não está sendo invocada (confirma que o fire-and-forget sequer é atingido, pois o código falha antes).
3. **Dados do usuário admin**: `company_id = 00000000-...-000000000001`, role = `admin`. RLS permite INSERT porque `has_role(auth.uid(), 'admin')` retorna `true` — sem restrição de company_id para admins.
4. **Cobranças recentes deste user**: Última criada em 18/fev. Todas com sucesso. INSERT funciona.
5. **Intermitência**: O problema não é determinístico. Quando o INSERT completa em <10s, funciona. Quando leva >10s (cold connection, RLS latência), o timeout artificial mata a operação.

## Causa raiz confirmada

**O erro exibido ("Tempo limite excedido ao salvar cobrança") é gerado pelo frontend, não pelo banco.** A string exata está hardcoded na linha 351 de `NewCharge.tsx`:

```typescript
setTimeout(() => reject(new Error('Tempo limite excedido ao salvar cobrança...')), 10000)
```

O INSERT está dentro de um `Promise.race` com 10s de timeout. Quando o Supabase leva >10s (latência de rede, avaliação das funções RLS `has_role` + `is_admin_or_operador` + `get_user_company_id`), o timer rejeita antes da resposta real chegar.

**Não há erro de banco, não há erro de RLS, não há erro de edge function.** O timeout artificial é a única causa da falha.

## Risco secundário identificado: `persistSession: false`

Em `src/integrations/supabase/client.ts` (linhas 13-22):
- Limpa **todo** `localStorage` com prefixo `sb-` no carregamento do módulo
- `persistSession: false` impede salvar sessão

Isso significa que o token JWT vive apenas em memória. Se o `autoRefreshToken` falhar silenciosamente (ex.: aba em background por >1h), o INSERT retornará erro de autenticação. Hoje esse erro está mascarado pelo timeout.

## Plano de correção (somente `src/pages/NewCharge.tsx`)

### 1. Remover `Promise.race` e `timeoutPromise` (linhas 309-354)

Reverter para chamada direta:
```typescript
const { data: charge, error: chargeError } = await supabase
  .from('charges')
  .insert({ ... })
  .select()
  .single();
```

### 2. Adicionar logging de duração para diagnóstico

```typescript
const t0 = performance.now();
const { data: charge, error: chargeError } = await supabase...;
console.log(`[NewCharge] INSERT durou ${(performance.now()-t0).toFixed(0)}ms`);
```

Isso revela a latência real sem mascarar erros.

### 3. Melhorar catch para mostrar erro real

No bloco `catch`, incluir detalhes do erro Supabase (code, details, hint):
```typescript
const msg = error?.message || 'Erro desconhecido';
const details = error?.details || error?.hint || '';
setError(`${msg}${details ? ` (${details})` : ''}`);
```

## O que NÃO muda

- Nenhum layout, cor ou componente visual
- Nenhuma edge function ou integração
- Fire-and-forget do link (mantido)
- Validação de `formatAmount` (mantida)
- `setIsLoading` dentro do `try` (mantido)

