

# Correcao do sync-payment-status: Eliminar conflito com sync-card-status

## Problema

O `sync-payment-status` opera sobre a tabela `charges` e atualiza o status diretamente com base na API Quita+. Para pagamentos combinados (`cartao_pix`), isso cria um conflito destrutivo:

1. `sync-card-status` atualiza o split de cartao, depois **deriva** o status do charge a partir de TODOS os splits (PIX + Cartao)
2. `sync-payment-status` roda logo depois e **sobrescreve** o charge status diretamente com o statusCode da API, ignorando completamente o split de PIX

Caso comprovado: KELMEY teve o charge corretamente derivado como `processing` (PIX pago + Cartao em analise), mas o sync-payment-status sobrescreveu para `pre_authorized` 26 segundos depois.

Alem disso, o statusCode 50 mapeia para `cnpj_nao_cadastrado`, que nao existe no enum `charge_status`.

## Solucao

Duas alteracoes no arquivo `supabase/functions/sync-payment-status/index.ts`:

### Alteracao 1: Corrigir statusCode 50

```text
Antes:  50: "cnpj_nao_cadastrado"
Depois: 50: "failed"
```

### Alteracao 2: Para pagamentos combinados, derivar status do charge a partir dos splits

Apos obter o status da API e atualizar o charge, verificar se o charge tem `payment_method = 'cartao_pix'`. Se sim, em vez de usar o mapeamento direto:

1. Atualizar o split de cartao correspondente (na tabela `payment_splits`) com o status equivalente da API (usando mapeamento de splits: 1=analyzing, 9=concluded, etc.)
2. Buscar TODOS os splits do charge
3. Derivar o status do charge a partir dos splits (mesma logica do sync-card-status):
   - Todos concluded -> `completed`
   - Algum cancelled e nenhum concluded -> `cancelled`
   - Algum failed e nenhum concluded -> `failed`
   - Algum concluded (parcial) -> `processing`
   - Algum analyzing -> `processing`
   - Senao -> `pending`

Para charges com `payment_method != 'cartao_pix'` (cartao puro), manter o comportamento atual de mapeamento direto.

### Mapeamento adicional necessario (split-level)

Adicionar um segundo mapeamento para atualizar splits quando o charge e combinado:

```text
const splitStatusCodeMap: Record<number, string> = {
  1: "analyzing",
  2: "cancelled",
  3: "boleto_linked",
  4: "validating",
  5: "failed",
  6: "approved",
  7: "awaiting_validation",
  8: "validating",
  9: "concluded",
  50: "failed",
};
```

### Fluxo atualizado para charges combinados

```text
1. Obter statusCode da API
2. Se payment_method == 'cartao_pix':
   a. Buscar split de credit_card com o pre_payment_key do charge
   b. Atualizar split com splitStatusCodeMap[statusCode]
   c. Buscar TODOS os splits do charge
   d. Derivar charge status a partir dos splits
   e. Atualizar charge com status derivado
3. Se payment_method != 'cartao_pix':
   a. Atualizar charge com statusCodeMap[statusCode] (comportamento atual)
```

### Resumo das alteracoes

| Local no arquivo | O que muda |
|---|---|
| Linha 20 (statusCodeMap) | `50: "cnpj_nao_cadastrado"` -> `50: "failed"` |
| Apos statusCodeMap (nova constante) | Adicionar `splitStatusCodeMap` para mapeamento de splits |
| Selects de charges (linhas 59-66) | Incluir `payment_method` no select |
| Bloco de atualizacao (linhas 207-265) | Para `cartao_pix`: atualizar split + derivar charge status. Para demais: manter logica atual |

### O que NAO muda

- Nenhum outro edge function (sync-card-status, conclude-card-payment, etc.)
- Nenhum componente de frontend
- A logica de charge_executions permanece (registrando a origem como sync-payment-status)
- A correcao de charges inconsistentes (pre_authorized sem pre_payment_key) permanece
- O rate limiting e filtros de data permanecem

### Resultado esperado

- Para pagamentos combinados: os dois sync functions passam a trabalhar de forma cooperativa em vez de conflitante
- O status do charge sempre reflete o estado real de TODOS os splits
- StatusCode 50 nao causa mais erro de constraint no banco

