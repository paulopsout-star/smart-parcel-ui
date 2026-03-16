

# Fix: Taxa PIX ainda calculada incorretamente

## Problema raiz

Dois bugs encadeados:

### Bug 1 — NewCharge armazena `fee_amount` mesmo sem inflar o `amount`

Em `NewCharge.tsx` (linhas 367-371), ao criar uma cobrança PIX, o código salva:
- `amount = 1000` (valor base, correto)
- `fee_amount = 15` (1.5% de 1000)
- `fee_percentage = 1.50`

O `amount` **não é inflado** (o comentário diz "taxa aplicada apenas no checkout"). Porém, `fee_amount > 0` é salvo no DB.

### Bug 2 — CheckoutPix subtrai `fee_amount` do `amount` incorretamente

Em `CheckoutPix.tsx` (linhas 166-171), o código faz:
```
hasPreInflatedAmount = charge.fee_amount > 0  → true (15 > 0)
baseCents = 1000 - 15 = 985   ← ERRADO, amount NÃO foi inflado
feeCents = round(985 * 0.015) = 15
totalCents = 985 + 15 = 1000  ← Cliente vê R$10,00 sem taxa!
```

O correto seria `baseCents = 1000`, `totalCents = 1015`.

### Dados corrompidos no DB

O split mais recente (`58cd84aa`) tem `display_amount_cents = 1050` (calculado com 5% antes do deploy). Deveria ser `1015`.

## Correção

### 1. `src/pages/NewCharge.tsx` — Não armazenar fee_amount para PIX

Como a taxa é calculada exclusivamente no checkout, remover o armazenamento de `fee_amount` e `fee_percentage` na criação:

```tsx
if (data.payment_method === 'pix') {
  // Taxa PIX calculada no checkout (CheckoutPix.tsx)
  // NÃO armazenar fee_amount aqui para evitar dupla subtração
  feeAmount = 0;
  feePercentage = 0;
}
```

### 2. `src/pages/CheckoutPix.tsx` — Simplificar cálculo do base

Remover a lógica de subtração de `fee_amount`. Para cobranças novas, `amount` já é o valor base. Para cobranças antigas (fee_amount pré-inflado com 5%), manter compatibilidade verificando `fee_percentage`:

```tsx
// Cobranças antigas tinham amount inflado (amount = base + 5%)
// Cobranças novas têm amount = base (taxa calculada aqui)
const isLegacyInflated = charge.fee_amount > 0 && charge.fee_percentage >= 5;
const baseCents = isLegacyInflated
  ? charge.amount - charge.fee_amount
  : charge.amount;
const feeCents = Math.round(baseCents * PIX_FEE_PERCENT);
const totalCents = baseCents + feeCents;
```

### 3. SQL — Corrigir split existente

```sql
UPDATE payment_splits 
SET display_amount_cents = 1015 
WHERE id = '58cd84aa-9ea1-466f-a9d2-68076e6495be';
```

## Resultado esperado

- Cobrança de R$ 10,00: base = 1000, taxa 1.5% = 15, total = R$ 10,15
- Cobranças legadas com 5% continuam funcionando via detecção de `fee_percentage >= 5`

