
# Plano de Correcao: Exibicao de Valor Original e Taxas para PIX Avulso

## Problemas Identificados

Com base na analise do banco de dados e do codigo, identifiquei dois problemas distintos:

### Problema 1: Valor exibido incorretamente

**Situacao Atual:**
- Usuario cadastra R$ 100,00
- Sistema salva `amount = 10500` (R$ 105,00 com taxa)
- Sistema salva `metadata.original_amount = 10000` (R$ 100,00 original)
- Sistema salva `fee_amount = 500` (R$ 5,00 de taxa)

**Exibicao Atual (incorreta):**
- Card "VALOR" mostra R$ 105,00 (valor com taxa)

**Exibicao Esperada:**
- Card "VALOR" deve mostrar R$ 100,00 (valor original informado pelo usuario)

### Problema 2: Modal de metodos de pagamento nao aparece

**Situacao Atual:**
- Para PIX avulso, nao existem splits ate o cliente pagar
- A condicao de exibicao do PaymentMethodsSummary exclui PIX avulso sem splits

**Comportamento Esperado:**
- Mesmo sem splits, o modal deve exibir valor original e taxas para PIX avulso

---

## Correcoes Propostas

### Correcao 1: Exibir valor original no header da cobranca

**Arquivo:** `src/pages/ChargeHistory.tsx`
**Local:** Linha 1725 (InfoCard de Valor)

**De:**
```typescript
<InfoCard icon={CreditCard} label="Valor" value={formatCurrency(selectedCharge.amount)} variant="primary" />
```

**Para:**
```typescript
// Para PIX avulso: usar valor original (sem taxa) 
// Para outros metodos: usar amount normal
const displayAmount = selectedCharge.payment_method === 'pix' && selectedCharge.fee_amount
  ? selectedCharge.amount - selectedCharge.fee_amount  // Subtrair taxa para mostrar original
  : selectedCharge.amount;

<InfoCard icon={CreditCard} label="Valor" value={formatCurrency(displayAmount)} variant="primary" />
```

### Correcao 2: Exibir modal de metodos de pagamento para PIX avulso

**Arquivo:** `src/pages/ChargeHistory.tsx`
**Local:** Linha 1859 (condicao de exibicao do PaymentMethodsSummary)

**De:**
```typescript
{(selectedCharge.payment_method === 'cartao_pix' || (selectedCharge.splits && selectedCharge.splits.length > 0)) && (
```

**Para:**
```typescript
{(selectedCharge.payment_method === 'cartao_pix' || 
  selectedCharge.payment_method === 'pix' ||  // Incluir PIX avulso
  (selectedCharge.splits && selectedCharge.splits.length > 0)) && (
```

### Correcao 3: Ajustar PaymentMethodsSummary para PIX avulso sem splits

**Arquivo:** `src/pages/ChargeHistory.tsx`
**Local:** Linhas 341-344 (condicao de retorno null)

**De:**
```typescript
// Se nao ha splits e nao e pagamento combinado
if (splits.length === 0 && charge.payment_method !== 'cartao_pix') {
  return null;
}
```

**Para:**
```typescript
// Se nao ha splits e nao e pagamento combinado nem PIX avulso
if (splits.length === 0 && charge.payment_method !== 'cartao_pix' && charge.payment_method !== 'pix') {
  return null;
}
```

### Correcao 4: Calcular valores PIX a partir do charge quando nao ha splits

**Arquivo:** `src/pages/ChargeHistory.tsx`
**Local:** Linhas 285-291 (calculo do pixBase quando nao ha split)

**De:**
```typescript
} else {
  // Sem split: calcular a partir do charge
  pixBase = charge.pix_amount || (charge.payment_method === 'pix' ? charge.amount : 0);
  pixFee = Math.round(pixBase * PIX_FEE_RATE);
  pixTotal = pixBase + pixFee;
  pixFeePercent = '5.0';
}
```

**Para:**
```typescript
} else {
  // Sem split: calcular a partir do charge
  // Para PIX avulso: amount JA inclui taxa, reverter
  if (charge.payment_method === 'pix' && charge.fee_amount) {
    pixTotal = charge.amount;  // Valor com taxa
    pixBase = charge.amount - charge.fee_amount;  // Valor original
    pixFee = charge.fee_amount;
    pixFeePercent = charge.fee_percentage?.toFixed(1) || '5.0';
  } else {
    pixBase = charge.pix_amount || (charge.payment_method === 'pix' ? charge.amount : 0);
    pixFee = Math.round(pixBase * PIX_FEE_RATE);
    pixTotal = pixBase + pixFee;
    pixFeePercent = '5.0';
  }
}
```

---

## Secao Tecnica

### Arquivos a Modificar

| Arquivo | Linhas | Alteracao |
|---------|--------|-----------|
| `src/pages/ChargeHistory.tsx` | 1725 | Exibir valor original (sem taxa) para PIX avulso |
| `src/pages/ChargeHistory.tsx` | 1859 | Incluir `payment_method === 'pix'` na condicao de exibicao |
| `src/pages/ChargeHistory.tsx` | 341-344 | Permitir renderizacao do PaymentMethodsSummary para PIX avulso |
| `src/pages/ChargeHistory.tsx` | 285-291 | Usar `fee_amount` do charge para calculo preciso |

### Dados Disponiveis na Tabela charges

Para PIX avulso, os campos relevantes sao:
- `amount`: valor COM taxa (ex: 10500)
- `fee_amount`: valor da taxa (ex: 500)
- `fee_percentage`: percentual da taxa (ex: 5.00)
- `metadata.original_amount`: valor ORIGINAL (ex: 10000)

### Resultado Esperado

Apos a correcao, ao visualizar uma cobranca PIX avulsa de R$ 100,00:

**Header:**
- Card "VALOR": R$ 100,00 (valor original)

**Modal de Metodos de Pagamento:**
- Valor original: R$ 100,00
- Taxa PIX (5%): + R$ 5,00
- Valor: R$ 105,00

### Impacto

- Corrige NOVAS e EXISTENTES cobrancas PIX avulso
- Usa dados ja salvos (`fee_amount`, `fee_percentage`)
- Nao altera fluxo de cadastro
- Nao altera integracao com APIs
