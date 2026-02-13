

# Análise e Correção da Taxa Dupla no PIX

## Diagnóstico

A correção implementada funciona **perfeitamente para novas cobranças**, mas **falha para cobranças antigas** que já tinham o `amount` inflado no banco.

**Evidência:**
- Cobrança nova (LUCIANO, 2026-02-13 17:38):
  - `charges.amount`: 55.157 (R$ 551,57 - **sem taxa**)
  - Split `display_amount_cents`: 57.915 (R$ 579,15 - taxa aplicada uma única vez) ✅

- Cobrança antiga (JOAO VITOR, 2026-02-13 15:24):
  - `charges.amount`: 1.522.500 (R$ 15.225,00 - **COM taxa**)
  - Split `display_amount_cents`: 1.598.625 (R$ 15.986,25 - **taxa aplicada de novo**) ❌

**Root cause:** Cobranças criadas antes da correção têm `amount` pré-inflado. Quando o CheckoutPix calcula `amount × 1.05`, aplica a taxa sobre um valor que já contém taxa.

## Solução

Modificar `src/pages/CheckoutPix.tsx` para **detectar se `fee_amount` existe** e usar como base o valor original calculado (`amount - fee_amount`), em vez de usar `amount` diretamente.

### Lógica Proposta

```typescript
const createPixPayment = useCallback(async () => {
  if (!charge || pixData) return;

  setCreating(true);
  try {
    // Para cobranças antigas com fee_amount, usar amount - fee_amount como base
    // Para cobranças novas (sem fee_amount), usar amount diretamente
    const hasPreInflatedAmount = charge.payment_method === 'pix' && charge.fee_amount && charge.fee_amount > 0;
    const baseCents = hasPreInflatedAmount 
      ? charge.amount - charge.fee_amount 
      : charge.amount;
    
    const feeCents = Math.round(baseCents * PIX_FEE_PERCENT);
    const totalCents = baseCents + feeCents;
    
    // Resto do código permanece igual
    ...
```

### Arquivos Afetados
- `src/pages/CheckoutPix.tsx` (linhas 160-163)

### O que NÃO muda
- Nenhuma Edge Function alterada
- Nenhuma alteração de banco de dados
- Nenhuma alteração de layout/UI
- `NewCharge.tsx` permanece igual (já corrigido)
- `ChargeHistory.tsx` permanece igual (já corrigido)

### Resultado Esperado

**Cobranças novas (sem fee_amount):**
- Base: R$ 551,57 (charge.amount)
- +5%: R$ 27,58
- Total: R$ 579,15 ✅

**Cobranças antigas (com fee_amount pré-inflado):**
- charge.amount: R$ 15.225,00 (inflado)
- charge.fee_amount: R$ 725,00 (taxa original)
- Base calculada: R$ 15.225,00 - R$ 725,00 = R$ 14.500,00
- +5%: R$ 725,00
- Total: R$ 15.225,00 ✅

