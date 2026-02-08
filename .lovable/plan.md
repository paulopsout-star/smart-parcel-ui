

# Correcao do Badge de Cartao com Boleto Ja Vinculado

## Objetivo

Ajustar a mensagem exibida ao admin no card de cartao de credito quando o split esta em `analyzing` mas o boleto ja foi vinculado (`has_boleto_link === true`). Alteracao puramente visual, sem impacto em regras de negocio.

## O que muda

No card de "Cartao de Credito" dentro dos detalhes da cobranca (ChargeHistory):

| Cenario | Badge | Mensagem Admin |
|---|---|---|
| `analyzing` + boleto NAO vinculado | "Pre pagamento autorizado" (azul) | "Aguardando o vinculo do boleto" |
| `analyzing` + boleto JA vinculado | "Pre pagamento autorizado" (azul) | "Boleto vinculado - Aguardando conclusao" |

## Detalhes Tecnicos

### Arquivo: `src/pages/ChargeHistory.tsx`

**Unica alteracao**: linhas 1932-1936, onde a mensagem condicional do admin e renderizada.

Trocar o texto fixo por uma verificacao de `selectedCharge.has_boleto_link`:

```text
{isAdmin && split.method === 'credit_card' && split.status === 'analyzing' && (
  <span className="text-xs text-blue-600 dark:text-blue-400">
    {selectedCharge.has_boleto_link
      ? 'Boleto vinculado - Aguardando conclusão'
      : 'Aguardando o vínculo do boleto'}
  </span>
)}
```

### O que NAO muda

- Badge "Pre pagamento autorizado" continua igual
- Nenhuma regra de negocio
- Nenhum fluxo de pagamento ou edge function
- Nenhum mapeamento de status no banco
- Nenhuma outra tela ou componente

