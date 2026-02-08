
# Correcao do sync-card-status: Sincronizacao de Splits de Cartao

## Problema Diagnosticado

O cron `sync-card-status` **nunca encontra splits para sincronizar** (logs confirmam: "Found 0 splits to check" em toda execucao). Isso acontece por dois bugs:

### Bug 1: Filtro de status incorreto
A funcao busca splits com `.in('status', ['pending', 'processing'])`, mas os splits de cartao sao criados pelo `conclude-card-payment` com status `analyzing` (statusCode 1 da API Quita+). O status `analyzing` nao esta no filtro, entao a funcao **ignora todos os splits que precisam de sincronizacao**.

### Bug 2: Mapeamento de statusCode inconsistente
O `sync-card-status` usa um mapeamento de statusCode diferente do `conclude-card-payment` (que cria os splits). Exemplo: statusCode 1 e mapeado para `pending` no sync, mas o split foi criado como `analyzing`.

## Solucao Proposta

Corrigir **apenas** o arquivo `supabase/functions/sync-card-status/index.ts`:

### Mudanca 1: Alinhar o statusCodeMap com o conclude-card-payment

O mapeamento do sync deve ser identico ao do conclude-card-payment, pois ambos operam sobre a mesma tabela `payment_splits`:

```text
statusCodeMap atual (ERRADO):        statusCodeMap corrigido:
1: 'pending'                         1: 'analyzing'
2: 'cancelled'                       2: 'cancelled'
3: 'boleto_linked'                   3: 'boleto_linked'
4: 'processing'                      4: 'validating'
5: 'failed'                          5: 'failed'
6: 'processing'                      6: 'approved'
7: 'processing'                      7: 'awaiting_validation'
8: 'processing'                      8: 'validating'
9: 'concluded'                       9: 'concluded'
50: 'failed'                         50: 'failed'
```

### Mudanca 2: Expandir o filtro de status

Incluir todos os status intermediarios que precisam de verificacao:

```text
Filtro atual:
  .in('status', ['pending', 'processing'])

Filtro corrigido:
  .in('status', ['pending', 'processing', 'analyzing', 'boleto_linked', 'approved', 'awaiting_validation', 'validating'])
```

### Resumo das alteracoes

| Local no arquivo | O que muda |
|---|---|
| Linhas 11-22 (statusCodeMap) | Alinhar com o mapeamento do conclude-card-payment |
| Linha 60 (filtro .in) | Adicionar status intermediarios ao filtro de busca |

### O que NAO muda

- Nenhuma outra edge function (conclude-card-payment, sync-payment-status, quitaplus-prepayment-status)
- Nenhum componente de frontend
- Nenhum fluxo de pagamento
- A logica de atualizacao de charges dentro do sync-card-status permanece inalterada
- A Query 2 (splits inconsistentes) permanece inalterada

### Resultado esperado

Apos o deploy, o cron `sync-card-status` passara a:
1. Encontrar os splits de cartao com status `analyzing`, `boleto_linked`, `approved`, etc.
2. Consultar a API Quita+ para cada um
3. Atualizar o status no banco com o mapeamento correto (identico ao conclude-card-payment)
4. Propagar o status para a tabela `charges` quando necessario
