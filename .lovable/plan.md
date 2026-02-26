

# Plano: Botão de alteração manual de status (Admin)

## Resumo

Adicionar um botão no painel de detalhes da cobrança (Sheet) que permite ao administrador alterar manualmente o status. O status alterado manualmente será "travado" — as Edge Functions de sincronização automática não poderão sobrescrevê-lo.

## Mudanças

### 1. Migração: adicionar coluna `status_locked_at` na tabela `charges`

Adicionar coluna `status_locked_at TIMESTAMPTZ DEFAULT NULL`. Quando preenchida, indica que o status foi definido manualmente por um admin e não deve ser sobrescrito por sincronizações automáticas.

### 2. Edge Functions: respeitar `status_locked_at`

Nos 4 arquivos que fazem `.update({ status })` em `charges`:
- `sync-card-status/index.ts` (linha 221)
- `conclude-card-payment/index.ts` (linha 250)
- `process-charge/index.ts` (linhas 79, 144, 198)
- `payment-splits/index.ts` (linha 191)

Antes de atualizar o status, verificar se `status_locked_at IS NOT NULL`. Se estiver travado, **pular** a atualização de status (log no console e continuar sem erro).

### 3. Frontend: `ChargeHistory.tsx` — seção de Status no painel de detalhes

Abaixo da seção "Status" existente (linha ~1905-1912), adicionar (somente para `isAdmin`):

- Um botão "Alterar Status" que abre um dropdown/select inline com os status disponíveis:
  `pending`, `processing`, `completed`, `failed`, `cancelled`, `pre_authorized`, `boleto_linked`, `approved`, `awaiting_validation`, `validating`, `payment_denied`
- Botão "Confirmar" que faz `UPDATE charges SET status = :newStatus, status_locked_at = now() WHERE id = :chargeId`
- Após sucesso: atualizar o `selectedCharge` local e mostrar toast de confirmação
- Badge indicativo "Status manual" quando `status_locked_at` não é null

### 4. Interface `Charge`: adicionar campo `status_locked_at`

Adicionar `status_locked_at?: string` à interface `Charge` e incluir na query de fetch.

## O que NÃO muda

- Layout/cores/posições dos elementos existentes
- Lógica de `getComputedStatus` e `getModernStatusBadge`
- Contratos de integração Quita+
- Fluxo de pagamento do cliente

