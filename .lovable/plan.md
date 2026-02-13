

# Correção do Valor PIX - JOAO VITOR ALVES DE ARAUJO

## Problema Identificado

O valor exibido na tela de PIX (R$ 15.986,25) resulta de uma **aplicacao dupla da taxa de 5%**:
- Valor base correto: R$ 14.500,00
- 1a aplicacao (incorreta): algum calculo anterior inflou o valor para ~R$ 15.225,00
- 2a aplicacao: CheckoutPix.tsx aplica mais 5% sobre o valor ja inflado, resultando em R$ 15.986,25

O valor correto deveria ser: R$ 14.500 x 1,05 = **R$ 15.225,00**

## Causa Raiz

Dois problemas:

1. **charge.amount esta com valor errado**: atualmente 1.525.000 (R$ 15.250), deveria ser 1.450.000 (R$ 14.500 - o valor base da divida)
2. **3 splits PIX duplicados**: foram criados com valores incorretos baseados no amount errado

## Plano de Correcao

### Passo 1: Corrigir dados da cobranca no banco
Criar Edge Function temporaria para executar:
- charge.amount = 1.450.000 (R$ 14.500 - valor base)
- charge.fee_amount = 72.500 (R$ 725 = 5% taxa PIX)
- charge.fee_percentage = 5.0
- charge.metadata.original_amount = 1.450.000

### Passo 2: Limpar splits PIX duplicados
Deletar os 3 splits existentes (todos com valores errados):
- c4bbc4eb-d754-4c22-a0a0-8ff9b04f9e4a
- 631c4a1a-4f40-4b42-8a65-ed15d9b78fdc
- d23c9ff2-fe4b-4ec3-bd5e-411458d2a537

### Passo 3: Corrigir CheckoutPix.tsx (RLS + fetch publico)
Alterar CheckoutPix.tsx para buscar dados via Edge Function `public-payment-link` ao inves de query direta na tabela `charges` (que e bloqueada por RLS para usuarios publicos). Isso segue o mesmo padrao do Checkout.tsx.

### Passo 4: Verificar calculo do PIX fee
Confirmar que CheckoutPix.tsx aplica 5% sobre charge.amount (agora R$ 14.500):
- 1.450.000 x 0,05 = 72.500
- Total = 1.450.000 + 72.500 = 1.522.500 = **R$ 15.225,00**

### Passo 5: Cleanup
Deletar a Edge Function temporaria apos a correcao dos dados.

## Resultado Esperado

- Valor exibido no checkout PIX: **R$ 15.225,00** (correto)
- Nenhuma duplicacao de splits
- Pagina PIX funcional para usuarios publicos (sem bloqueio RLS)

## Detalhes Tecnicos

### Alteracoes em arquivos:
1. `supabase/functions/update-charge-exception/index.ts` - Criar (temporaria, deletar apos uso)
2. `src/pages/CheckoutPix.tsx` - Alterar fetch de dados de query direta para `public-payment-link`

### Calculo correto:
```text
charge.amount = 1,450,000 (R$ 14.500,00 - base)
PIX fee = 5% = 72,500 (R$ 725,00)
Total PIX = 1,522,500 (R$ 15.225,00)
```

### O que NAO muda:
- Nenhuma alteracao em layout/UI (apenas fonte dos dados no CheckoutPix)
- Nenhuma mudanca em outras Edge Functions
- Nenhuma alteracao em RLS policies
