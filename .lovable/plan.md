
# Correção da Taxa Dupla no PIX - Causa Real

## Problema

A correção anterior atualizou `charges.amount` para 1.450.000, porém **não atualizou** `payment_links.amount`, que continua em **1.525.000** (R$ 15.250).

O fluxo atual:
1. `CheckoutPix.tsx` chama `public-payment-link?id=994ce854...`
2. A Edge Function encontra o registro em `payment_links` (que tem prioridade) e retorna `amount_cents: 1.525.000`
3. `CheckoutPix.tsx` recebe `charge.amount = 1.525.000` e aplica +5%: `1.525.000 x 1.05 = 1.601.250` (~R$ 16.012)
4. Resultado: valor exibido errado (R$ 15.986,25 com arredondamentos)

## Solução

### Passo 1: Corrigir `payment_links.amount` no banco
Atualizar o registro `994ce854-dcb2-4766-b839-929802e2e116` em `payment_links`:
- `amount`: de 1.525.000 para **1.450.000** (R$ 14.500 - valor base)

Isso sera feito via Edge Function temporaria (criar, executar, deletar).

### Passo 2: Limpar splits antigos (se existirem)
Deletar quaisquer splits com valores incorretos que possam ter sido criados durante testes anteriores, para que o sistema crie um novo com os valores corretos.

### Resultado esperado
- `public-payment-link` retorna `amount_cents: 1.450.000`
- `CheckoutPix.tsx` aplica 5%: `1.450.000 x 1.05 = 1.522.500`
- Valor exibido: **R$ 15.225,00** (correto)

## Detalhes Tecnicos

### Dados atuais no banco:
- `charges.amount` = 1.450.000 (ja corrigido)
- `payment_links.amount` = 1.525.000 (ERRADO - precisa corrigir)

### Calculo correto:
```text
payment_links.amount = 1,450,000 (R$ 14.500,00)
PIX fee 5% = 72,500 (R$ 725,00)
Total = 1,522,500 (R$ 15.225,00)
```

### Arquivos:
1. `supabase/functions/fix-payment-link-amount/index.ts` - Edge Function temporaria (criar e deletar)
2. Nenhuma alteracao em codigo frontend (a logica do CheckoutPix.tsx ja esta correta, o problema era apenas o dado no banco)
