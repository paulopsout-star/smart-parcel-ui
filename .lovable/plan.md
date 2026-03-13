

# Fix: Valores incorretos na exibição de cobranças PIX

## Problema identificado

Dois bugs distintos:

### Bug 1 — Card "VALOR" mostra R$ 1,97 em vez de R$ 2,00
**Linha 1610-1613 do ChargeHistory.tsx**: O código faz `amount - fee_amount` (200 - 3 = 197), mas `amount` já armazena o valor base da dívida (sem taxa). A subtração é incorreta.

**Correção**: Exibir `charge.amount` diretamente, sem subtrair `fee_amount`.

### Bug 2 — Split PIX mostra R$ 2,10 (5%) em vez de R$ 2,03 (1.5%)
**Dados no banco**: O `payment_splits` dessa cobrança tem `display_amount_cents = 210`, calculado com a taxa antiga de 5% antes do deploy da alteração.

Além disso, o **Checkout.tsx** (fluxo combinado PIX+Cartão) **não salva `display_amount_cents`** no split PIX (linha 214-222), o que força o ChargeHistory a usar fallback de reversão.

**Correções**:
1. **Checkout.tsx**: Adicionar `display_amount_cents: pixTotalCents` ao split PIX no fluxo combinado
2. **Dados existentes**: Corrigir o split dessa cobrança específica via SQL: `display_amount_cents` de 210 para 203

## Arquivos a alterar

### 1. `src/pages/ChargeHistory.tsx` (linha 1610-1614)
Remover a subtração de fee_amount — exibir `charge.amount` diretamente:
```tsx
<InfoCard icon={CreditCard} label="Valor" value={formatCurrency(
  selectedCharge.amount
)} variant="primary" />
```

### 2. `src/pages/Checkout.tsx` (linha 214-222)
Adicionar `display_amount_cents` ao split PIX:
```tsx
splits.push({
  charge_id: chargeId,
  payment_link_id: paymentLinkId,
  method: 'pix',
  amount_cents: /* base cents (sem taxa) */,
  display_amount_cents: pixTotalCents, // Total COM taxa
  order_index: 1,
  status: 'pending',
});
```
Nota: `pixTotalCents` já inclui a taxa. Precisamos também receber o valor base separadamente do `onConfirm` do CombinedCheckoutSummary.

### 3. SQL de correção de dados
Atualizar os splits existentes dessa cobrança para o valor correto (203 em vez de 210).

