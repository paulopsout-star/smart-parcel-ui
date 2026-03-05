

# Diagnóstico: INSERT Travando para Cobranças Combinadas

## Evidência

- Screenshot mostra botão "Criando cobrança..." (loading infinito)
- CPF `78344517079` **não existe** na tabela `charges` → INSERT nunca completou
- Validação Zod **passou** (senão o toast de `onValidationError` apareceria e o botão não mudaria para loading)
- O código está travado no `await supabase.from('charges').insert(...).select().single()` (linha 364)

## Causa Provável

A policy RLS de INSERT chama `is_admin_or_operador(auth.uid())` e `get_user_company_id(auth.uid())`. Se essas funções sofrem cold start ou deadlock, a requisição HTTP ao PostgREST fica pendente indefinidamente. O `finally { setIsLoading(false) }` nunca executa porque a Promise nunca resolve nem rejeita.

Outra possibilidade: o `.select().single()` após o INSERT falha se a policy de SELECT não retorna o row recém-inserido (ex: admin inseriu com `company_id` diferente do seu, e `get_user_company_id` retorna a company do perfil, não a selecionada).

## Plano de Correção

### Arquivo: `src/pages/NewCharge.tsx`

**Adicionar timeout de segurança (15s) no INSERT** para garantir que o `isLoading` sempre resete:

```typescript
// Envolver o INSERT em Promise.race com timeout
const insertPromise = supabase
  .from('charges')
  .insert({...})
  .select()
  .single();

const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('TIMEOUT_INSERT')), 15000)
);

const { data: charge, error: chargeError } = await Promise.race([
  insertPromise,
  timeoutPromise
]) as any;
```

**Adicionar log no ponto exato de travamento** (antes e depois do INSERT):

```typescript
console.log('[NewCharge] ⏳ Iniciando INSERT...', { company_id: targetCompanyId });
// ... INSERT ...
console.log('[NewCharge] ✅ INSERT concluído em Xms');
```

**Tratamento do timeout**:
- Se `TIMEOUT_INSERT`, mostrar toast: "A cobrança pode ter sido criada. Verifique o histórico."
- Redirecionar para `/charges` para o operador conferir

### Nenhuma alteração em:
- Edge functions
- Layout/UI (mesmos componentes, mesmo visual)
- Schemas do banco
- Lógica de split ou checkout

