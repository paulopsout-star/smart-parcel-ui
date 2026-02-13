

# Correção do Valor Exibido no Painel (Histórico de Cobranças)

## Problema

A coluna "Valor" no histórico de cobranças exibe `charge.amount` diretamente. Para cobranças PIX, esse campo já contém o valor COM a taxa de 5% incluída. O correto é exibir o valor **original da dívida** (sem taxa).

Exemplo atual:
- Exibido: R$ 15.225,00 (valor com taxa)
- Correto: R$ 14.500,00 (valor original)

## Causa

Linha 578 de `ChargeHistory.tsx` usa `formatCurrency(charge.amount)` sem descontar `fee_amount` para cobranças PIX.

A mesma correção já existe na view de detalhes (linhas 1742-1745), mas não foi aplicada na listagem.

## Solução

Alterar a exibição da coluna "Valor" (linha 578) para usar a mesma lógica da view de detalhes:

- Se `payment_method === 'pix'` e `fee_amount` existe: exibir `charge.amount - charge.fee_amount`
- Caso contrário: exibir `charge.amount` normalmente

## Detalhes Técnicos

### Arquivo alterado:
- `src/pages/ChargeHistory.tsx` (linha 578)

### Lógica:
```text
Antes:  formatCurrency(charge.amount)
Depois: formatCurrency(
          charge.payment_method === 'pix' && charge.fee_amount
            ? charge.amount - charge.fee_amount
            : charge.amount
        )
```

### O que NÃO muda:
- Nenhuma alteração em Edge Functions ou integrações
- Nenhuma alteração de layout/UI (apenas o valor numérico exibido)
- A view de detalhes (Sheet) já exibe corretamente e permanece igual

