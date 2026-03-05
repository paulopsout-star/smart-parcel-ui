

# Plano: Adicionar Logs Diagnósticos para Cobranças Combinadas

## Problema
Quando a validação Zod falha no formulário `cartao_pix`, o `handleSubmit(onSubmit)` na linha 487 simplesmente não chama `onSubmit` — sem log, sem toast, sem feedback. Isso torna impossível diagnosticar o que travou.

## O que será feito

### 1. Adicionar `onValidationError` no `handleSubmit` (NewCharge.tsx, linha 487)

Trocar:
```typescript
<form onSubmit={handleSubmit(onSubmit)}>
```
Por:
```typescript
<form onSubmit={handleSubmit(onSubmit, onValidationError)}>
```

A função `onValidationError` vai:
- Logar no console **todos os campos inválidos** com seus valores e mensagens de erro
- Logar o estado completo do formulário (payment_method, amount, pix_amount, card_amount, boleto_linha_digitavel)
- Exibir um **toast destrutivo** listando os campos com problema

### 2. Expandir logs no `onSubmit` para `cartao_pix`

Dentro do `onSubmit` (linha 250), logo no início, adicionar log detalhado quando `payment_method === 'cartao_pix'`:
- Valores de `pix_amount`, `card_amount`, `amount` (raw e em centavos)
- Soma do split vs total
- Estado da `boleto_linha_digitavel` (length, primeiros 8 chars)
- Estado do `creditorSettings`
- Tempo de cada etapa (já existe `t0` para o INSERT, manter)

### 3. Log no INSERT para `cartao_pix`

Após o INSERT (linha 351), logar campos específicos da cobrança combinada que foram salvos:
- `pix_amount`, `card_amount`, `boleto_pix_cartao_linha_digitavel`

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/NewCharge.tsx` | Adicionar `onValidationError`, expandir logs no `onSubmit` para `cartao_pix` |

### O que NÃO muda
- Nenhuma lógica de negócio alterada
- Nenhum layout/UI alterado
- Nenhuma edge function alterada
- Apenas adição de `console.log`, `console.warn` e um toast informativo quando validação falha

