

# Correção Definitiva da Taxa Dupla no PIX

## Problema

A taxa de 5% do PIX está sendo aplicada **duas vezes**:

1. **Na criação** (`NewCharge.tsx`, linhas 279-283): calcula 5% e soma ao `charges.amount`
2. **No checkout** (`CheckoutPix.tsx`, linhas 160-163): calcula 5% novamente sobre o valor já inflado

## Solução: Remover a taxa da criação, manter apenas no checkout

A taxa deve ser aplicada **somente no checkout** (`CheckoutPix.tsx`), pois é no momento do pagamento que o cliente precisa ver o valor final. O `charges.amount` deve armazenar sempre o **valor original da dívida**.

### Alteração 1: `src/pages/NewCharge.tsx` (linhas 279-283)

Remover o cálculo e soma da taxa para PIX. O `charges.amount` passará a gravar o valor original.

**Antes:**
```text
if (data.payment_method === 'pix') {
  feeAmount = Math.round(amountInCents * 0.05);
  feePercentage = 5.00;
  amountInCents = amountInCents + feeAmount;
}
```

**Depois:**
```text
if (data.payment_method === 'pix') {
  feeAmount = Math.round(amountInCents * 0.05);
  feePercentage = 5.00;
  // NÃO soma ao amountInCents - taxa aplicada apenas no checkout
}
```

Isso faz com que `charges.amount` = valor original e `charges.fee_amount` = valor da taxa (para referência), sem alterar o amount.

### Alteração 2: `src/pages/ChargeHistory.tsx` (linha 577-581)

Reverter a correção anterior, pois agora `charges.amount` já conterá o valor original (sem taxa). A subtração de `fee_amount` não será mais necessária.

**Antes (correção recente):**
```text
formatCurrency(
  charge.payment_method === 'pix' && charge.fee_amount
    ? charge.amount - charge.fee_amount
    : charge.amount
)
```

**Depois:**
```text
formatCurrency(charge.amount)
```

### Alteração 3: `src/pages/CheckoutPix.tsx` - Nenhuma alteração

O código do checkout **permanece como está**, pois a lógica de aplicar 5% sobre o valor base está correta. Com `charges.amount` agora armazenando o valor original, o cálculo será:
- Base: R$ 14.500,00 (valor original, sem taxa)
- +5%: R$ 725,00
- Total: R$ 15.225,00 (correto)

### O que NÃO muda
- Nenhuma Edge Function alterada
- Nenhuma alteração de layout/UI
- `CheckoutPix.tsx` permanece igual
- View de detalhes do `ChargeHistory.tsx` precisa ser verificada para consistência

### Impacto em cobranças existentes
- Cobranças PIX **já criadas** continuam com `amount` inflado no banco. A correção se aplica apenas a **novas cobranças**.
- Para cobranças existentes (como JOAO VITOR), o `charges.amount` já foi corrigido manualmente para 1.450.000 anteriormente.

