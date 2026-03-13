

# Plano: Alterar taxa PIX de 5% para 1,5%

## Locais a alterar

Existem **4 arquivos** com o percentual da taxa PIX hardcoded:

### 1. `src/pages/CheckoutPix.tsx` (linha 36)
- `PIX_FEE_PERCENT = 0.05` → `0.015`
- Comentário `5% fee` → `1.5% fee`

### 2. `src/components/CombinedCheckoutSummary.tsx` (linha 11)
- `PIX_FEE_PERCENT = 0.05` → `0.015`

### 3. `src/pages/NewCharge.tsx` (linhas 368-369)
- `amountInCents * 0.05` → `amountInCents * 0.015`
- `feePercentage = 5.00` → `feePercentage = 1.50`

### 4. `src/pages/ChargeHistory.tsx` (linhas 265-302)
- `PIX_FEE_RATE = 0.05` → `0.015`
- Comentário `5%` → `1.5%`
- Fallbacks `'5.0'` → `'1.5'` (3 ocorrências nas linhas 282, 289, 297, 302)
- Divisor legado `1.05` → `1.015` (linha 287)

### Não alterar
- `supabase/functions/refunds-scheduler/index.ts` — `REFUND_FEE_PERCENT = 5.0` é taxa de reembolso, não taxa PIX
- Demais ocorrências de `0.05` em arquivos visuais/mock não relacionados

## Observação
Cobranças existentes com `fee_percentage` salvo como `5.0` no banco continuarão exibindo corretamente via `charge.fee_percentage`, pois o ChargeHistory prioriza o valor do DB. A mudança afeta apenas novas cobranças.

