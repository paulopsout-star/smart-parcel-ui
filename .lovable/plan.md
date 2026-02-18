
# Correção: Headers de Autenticação nas Chamadas Internas entre Edge Functions

## Causa Raiz do Erro

Quando a Edge Function `quitaplus-prepayment` chama internamente `quitaplus-token` e `quitaplus-link-boleto` via `fetch`, ela **não inclui o header `apikey`**. Mesmo com `verify_jwt = false`, o gateway do Supabase exige o `apikey` para autenticar chamadas HTTP entre funções. Sem ele, o gateway retorna um erro não-2xx, que o código trata com `throw new Error(...)` e o frontend recebe como "Edge Function returned a non-2xx status code".

Mesma falha potencial existe em `admin-link-boleto` → `quitaplus-link-boleto`.

## Escopo Aprovado

Escopo: INTEGRAÇÃO
Arquivos: `supabase/functions/quitaplus-prepayment/index.ts`, `supabase/functions/admin-link-boleto/index.ts`

## Alterações

### 1. `supabase/functions/quitaplus-prepayment/index.ts`

**Chamada para `quitaplus-token` (linhas 126-132):**

Antes:
```typescript
const tokenResponse = await fetch(`${supabaseUrl}/functions/v1/quitaplus-token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({}),
});
```

Depois:
```typescript
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const tokenResponse = await fetch(`${supabaseUrl}/functions/v1/quitaplus-token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({}),
});
```

**Chamada para `quitaplus-link-boleto` (linhas 469-483):**

Antes:
```typescript
const linkResponse = await fetch(`${supabaseUrl}/functions/v1/quitaplus-link-boleto`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  ...
```

Depois:
```typescript
const linkResponse = await fetch(`${supabaseUrl}/functions/v1/quitaplus-link-boleto`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  ...
```

### 2. `supabase/functions/admin-link-boleto/index.ts`

**Chamada para `quitaplus-link-boleto` (linhas 176-180):**

Antes:
```typescript
const linkResponse = await fetch(`${supabaseUrl}/functions/v1/quitaplus-link-boleto`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
```

Depois:
```typescript
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const linkResponse = await fetch(`${supabaseUrl}/functions/v1/quitaplus-link-boleto`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
```

## Resultado Esperado

- Pagamento com cartão passa a funcionar: `quitaplus-prepayment` → `quitaplus-token` retorna o accessToken corretamente
- Vínculo de boleto automático (cartão simples) também funciona: `quitaplus-prepayment` → `quitaplus-link-boleto`
- Vínculo manual pelo admin também funciona: `admin-link-boleto` → `quitaplus-link-boleto`

## O que NÃO muda
- Nenhuma lógica de negócio alterada
- Nenhum schema ou dado no banco alterado
- Nenhuma tela/UI alterada
- `SUPABASE_ANON_KEY` já está disponível como variável de ambiente em todas as Edge Functions do Supabase automaticamente
