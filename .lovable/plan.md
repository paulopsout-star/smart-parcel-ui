

# Alteracao de Status Visual do Cartao em Pagamentos Combinados

## Objetivo

Alterar **apenas a exibicao** do status do split de cartao de credito no historico de cobrancas para pagamentos combinados (`cartao_pix`). Nenhuma regra de negocio, fluxo ou integracao sera modificada.

## O que muda

No card de "Cartao de Credito" dentro dos detalhes da cobranca (ChargeHistory), quando o split de cartao estiver com status `analyzing` (pre-pagamento recebido pela Quita+):

**Antes:**
- Badge: "Pendente" (amarelo) -- para todos os usuarios

**Depois:**
- Badge: "Pre pagamento autorizado" (azul/info) -- para todos os usuarios
- Mensagem adicional (somente admin): "Aguardando o vinculo do boleto"

## Detalhes Tecnicos

### Arquivo: `src/pages/ChargeHistory.tsx`

**Trecho afetado:** Funcao `getSplitBadgeConfig()` (linhas 1889-1912)

Atualmente, o fallback final (linha 1911) retorna `"Pendente"` para qualquer status que nao seja `failed`, `cancelled`, `concluded` ou terminal. O status `analyzing` cai nesse fallback.

**Alteracao proposta:**

Antes do return final "Pendente" (linha 1911), adicionar uma verificacao:

```text
// Se o split de cartao esta em 'analyzing' (pre-pagamento autorizado)
if (split.method === 'credit_card' && split.status === 'analyzing') {
  return { variant: 'info' as const, label: 'Pre pagamento autorizado' };
}
```

Alem disso, logo abaixo do Badge no card do split (linha 1924), adicionar uma mensagem condicional visivel **apenas para admins**:

```text
{isAdmin && split.method === 'credit_card' && split.status === 'analyzing' && (
  <span className="text-xs text-blue-600 dark:text-blue-400">
    Aguardando o vinculo do boleto
  </span>
)}
```

### Resumo das mudancas

| Local | Mudanca |
|---|---|
| `getSplitBadgeConfig()` (L1908-1911) | Novo caso para `analyzing` retornando badge "Pre pagamento autorizado" com variante `info` (azul) |
| Card do split (L1922-1924) | Mensagem "Aguardando o vinculo do boleto" visivel apenas para admin |

### O que NAO muda

- Nenhuma regra de negocio
- Nenhum fluxo de pagamento
- Nenhuma edge function
- Nenhum mapeamento de status no banco
- Nenhuma outra tela ou componente
- O status `analyzing` continua sendo usado internamente da mesma forma

