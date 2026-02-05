
# Plano de Correção: Taxa PIX em Cobranças Simples

## Problema Identificado

No ChargeHistory, a exibição da taxa PIX usa o campo errado:

```typescript
// Linha 266 - ATUAL (incorreto)
const pixTotal = pixSplit?.amount_cents || (pixBase + pixFeeCalculated);
```

Para cobranças PIX 100% (payment_method = 'pix'), os dados estao **corretos** no banco:
- `amount_cents` = valor original (ex: 22108)
- `display_amount_cents` = valor com taxa 5% (ex: 23213)

Mas o codigo usa `amount_cents` como total, resultando em taxa = 0.

## Correcao Proposta

### 1. Alterar calculo no ChargeHistory.tsx (linha 266)

**De:**
```typescript
const pixTotal = pixSplit?.amount_cents || (pixBase + pixFeeCalculated);
```

**Para:**
```typescript
// Priorizar display_amount_cents (valor COM taxa)
// Se nao existir, calcular: valor pago / 1.05 = base, diferenca = taxa
const pixTotal = pixSplit?.display_amount_cents 
  || pixSplit?.amount_cents 
  || (pixBase + pixFeeCalculated);
```

### 2. Ajustar calculo do valor base (linhas 262-270)

```typescript
// Calculos para PIX - sempre calcular 5% de taxa
const PIX_FEE_RATE = 0.05;

// Se ha split com display_amount_cents, usar os valores corretos
if (pixSplit?.display_amount_cents) {
  // display_amount_cents = valor com taxa (total pago)
  // amount_cents = valor original (base)
  const pixTotal = pixSplit.display_amount_cents;
  const pixBase = pixSplit.amount_cents;
  const pixFee = pixTotal - pixBase;
  const pixFeePercent = ((pixFee / pixBase) * 100).toFixed(1);
} else if (pixSplit?.amount_cents) {
  // Caso antigo: apenas amount_cents existe e JA inclui taxa
  // Reverter: base = total / 1.05
  const pixTotal = pixSplit.amount_cents;
  const pixBase = Math.round(pixTotal / (1 + PIX_FEE_RATE));
  const pixFee = pixTotal - pixBase;
  const pixFeePercent = ((pixFee / pixBase) * 100).toFixed(1);
} else {
  // Sem split: calcular a partir do charge
  const pixBase = charge.pix_amount || (charge.payment_method === 'pix' ? charge.amount : 0);
  const pixFee = Math.round(pixBase * PIX_FEE_RATE);
  const pixTotal = pixBase + pixFee;
  const pixFeePercent = '5.0';
}
```

---

## Secao Tecnica

### Arquivo a Modificar

| Arquivo | Linhas | Alteracao |
|---------|--------|-----------|
| `src/pages/ChargeHistory.tsx` | 260-270 | Refatorar logica de calculo PIX para priorizar `display_amount_cents` e reverter 5% quando apenas `amount_cents` existe |

### Logica de Reversao (para dados antigos)

Para cobranças pagas onde `display_amount_cents` e NULL:

```typescript
// amount_cents JA inclui taxa de 5%
const valorPago = pixSplit.amount_cents;  // ex: 189000

// Subtrair 5%: valorOriginal = valorPago / 1.05
const valorOriginal = Math.round(valorPago / 1.05);  // ex: 180000

// Taxa = diferenca
const taxa = valorPago - valorOriginal;  // ex: 9000
const percentual = (taxa / valorOriginal) * 100;  // ex: 5.0%
```

### Exemplo com Dados Reais

Cobrança combinada `charge_id: 754ff954`:
- `amount_cents: 179550` (valor ja com taxa)
- `display_amount_cents: null`

**Calculo corrigido:**
- Base = 179550 / 1.05 = 171000
- Taxa = 179550 - 171000 = 8550
- Percentual = (8550 / 171000) * 100 = 5.0%

### Impacto

- Nao altera dados no banco
- Nao altera integracao com APIs
- Apenas corrige exibicao no historico
- Funciona para dados antigos (sem display_amount_cents) e novos (com display_amount_cents)
