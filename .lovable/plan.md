

# Investigação: Freeze na Criação de Cobranças Combinadas (cartao_pix)

## Fluxo Completo Rastreado

```text
[Botão "Criar Cobrança"]
  → handleSubmit(onSubmit, onValidationError)
    → Zod valida: boleto 47 dígitos, pix_amount, card_amount
      → SE FALHA: onValidationError → toast (fácil de ignorar)
      → SE PASSA: onSubmit()
        → isSettingsValid? SE NÃO → toast + return (sem loading indicator)
        → setIsLoading(true)
        → Promise.race([INSERT charges, timeout 15s])
          → SE TIMEOUT: navega /charges
          → SE SUCESSO: fire-and-forget charge-links + mostra CheckoutSuccessModal
        → finally: setIsLoading(false)
```

## Causas-Raiz Identificadas (3 pontos de falha)

### 1. Validação Zod BLOQUEIA sem feedback visual claro (MAIS PROVÁVEL)

**Arquivo**: `src/pages/NewCharge.tsx`, linhas 61-99

O `superRefine` valida `boleto_linha_digitavel` (47 dígitos) e presença de `pix_amount`/`card_amount`, mas:
- Falta validação de **soma** (`pix_amount + card_amount == amount`)
- O `onValidationError` exibe um toast, mas NÃO scroll até o erro, NÃO destaca campos, e o usuário pode simplesmente não notar
- Os console.warn no `onValidationError` não apareceram nos logs, o que indica que o usuário **não reproduziu o bug nesta sessão** (estava em `/charges`, não em `/charges/new`)

### 2. `isSettingsValid` retorna `false` → return silencioso

**Arquivo**: `src/pages/NewCharge.tsx`, linhas 310-318

Se `company-settings` edge function falhar ou retornar dados incompletos, `isSettingsValid = false`. O código faz:
```js
if (!isSettingsValid) {
  toast({ title: 'Configurações da empresa ausentes', ... });
  return;  // ← RETURN SEM setIsLoading(true) → botão fica "normal" mas nada acontece
}
```
O toast aparece e desaparece rapidamente. O usuário pensa que "travou" porque o botão não mudou de estado.

**Evidência**: Os logs de `company-settings` mostram que a função retorna dados válidos. Mas se houver falha de rede esporádica, o hook retorna `isValid: false` temporariamente.

### 3. INSERT com Promise.race pode causar comportamento inesperado

**Arquivo**: `src/pages/NewCharge.tsx`, linhas 362-429

O `insertPromise` é um PostgREST builder (thenable, não Promise nativa). Em cenários de latência alta (ex: banco ocupado com `sync-payment-status` processando 14 charges em 28s), o INSERT pode demorar vários segundos. O usuário vê "Criando cobrança..." mas interpreta como freeze.

## Plano de Correção (4 mudanças)

### Mudança 1: Adicionar validação de soma ao Zod schema
**Arquivo**: `src/pages/NewCharge.tsx`, linhas 82-98

Dentro do `superRefine` para `cartao_pix`, após verificar presença de `pix_amount` e `card_amount`, adicionar:
```js
if (data.pix_amount && data.card_amount) {
  const pixCents = currencyToCents(data.pix_amount);
  const cardCents = currencyToCents(data.card_amount);
  const totalCents = currencyToCents(data.amount);
  if (pixCents + cardCents !== totalCents) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Soma PIX (${pixCents}) + Cartão (${cardCents}) deve ser igual ao total (${totalCents})`,
      path: ["card_amount"],
    });
  }
}
```
Import `currencyToCents` de `@/lib/input-masks` (já existe, retorna `parseInt(digits) || 0`).

### Mudança 2: Melhorar feedback de erro de validação
**Arquivo**: `src/pages/NewCharge.tsx`, função `onValidationError`

Após o toast, scroll até o primeiro campo com erro:
```js
const firstErrorField = Object.keys(errors)[0];
const el = document.getElementById(firstErrorField) || document.querySelector(`[name="${firstErrorField}"]`);
el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
el?.focus();
```

### Mudança 3: Remover Promise.race e usar await direto com AbortController
**Arquivo**: `src/pages/NewCharge.tsx`, linhas 362-429

Substituir o padrão `Promise.race` por um `AbortController` com timeout nativo do fetch (mais robusto):
```js
const { data: charge, error: chargeError } = await supabase
  .from('charges')
  .insert({...})
  .select()
  .single();
```
Remover o `timeoutPromise` e o `Promise.race`. O Supabase client já tem timeout interno. Se realmente necessário, usar `AbortController` no fetch subjacente. Isso elimina a complexidade e comportamento imprevisível do race com thenables.

### Mudança 4: Garantir loading state no check de isSettingsValid
**Arquivo**: `src/pages/NewCharge.tsx`, linhas 310-318

Mover o `setIsLoading(true)` para ANTES do check de `isSettingsValid`, e adicionar `setIsLoading(false)` no early return:
```js
setIsLoading(true);
if (!isSettingsValid) {
  toast({...});
  setIsLoading(false);  // ← NOVO: limpar loading
  return;
}
```
Isso garante que o botão mude visualmente mesmo no early return, dando feedback ao usuário.

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/NewCharge.tsx` | Validação soma, scroll-to-error, remover Promise.race, loading fix |

Nenhuma mudança em edge functions, integrations, schemas ou UI layout.

## Verificação Pós-Fix

1. Criar cobrança `cartao_pix` com soma incorreta → deve mostrar erro inline + scroll
2. Criar cobrança `cartao_pix` com todos campos válidos → deve funcionar sem freeze
3. Criar cobrança `cartao_pix` sem `boleto_linha_digitavel` → deve mostrar erro inline

