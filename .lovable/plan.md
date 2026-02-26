

# Plano: Alterar tipo de pagamento da cobrança (Admin)

## Resumo

Adicionar um botão no painel de detalhes (abaixo do seletor de status manual) que permite ao admin alterar o `payment_method` de uma cobrança. Quando o método muda (ex: `cartao_pix` → `pix`), o `amount` é recalculado para refletir apenas o valor do método mantido.

## Mudanças

### `src/pages/ChargeHistory.tsx`

**1. Novos estados**

Adicionar `editingPaymentMethod`, `newPaymentMethod` e `savingPaymentMethod` (similar ao padrão do status manual).

**2. UI: Seção "Alterar Tipo de Pagamento" (admin only)**

Abaixo do bloco de "Alterar Status" (~linha 1991), inserir:

- Botão "Alterar Tipo de Pagamento" (visível apenas para admin)
- Select com opções: `cartao` (Cartão), `pix` (PIX), `cartao_pix` (Cartão + PIX)
- Ao selecionar, exibir preview do novo valor total:
  - Se mudar de `cartao_pix` para `pix`: novo total = `pix_amount` da cobrança
  - Se mudar de `cartao_pix` para `cartao`: novo total = `card_amount` da cobrança
  - Se mudar para `cartao_pix`: manter valor atual (requer redistribuição posterior)
  - Se o método não muda, botão desabilitado
- Botão "Confirmar" que executa:
  ```sql
  UPDATE charges SET 
    payment_method = :newMethod,
    amount = :newAmount,
    pix_amount = CASE WHEN newMethod='cartao' THEN NULL ELSE pix_amount END,
    card_amount = CASE WHEN newMethod='pix' THEN NULL ELSE card_amount END
  WHERE id = :chargeId
  ```
- Deletar splits pendentes do método removido (`payment_splits` com `status='pending'` e método removido)
- Toast de confirmação + atualização local do estado

**3. Lógica de recálculo de valor**

Quando admin muda de combinado para método único:
- `cartao_pix → pix`: `amount = pix_amount`, `card_amount = null`
- `cartao_pix → cartao`: `amount = card_amount`, `pix_amount = null`
- `pix → cartao` ou `cartao → pix`: mantém `amount` atual, ajusta campos auxiliares
- `cartao/pix → cartao_pix`: mantém `amount` atual (admin precisará configurar split depois)

## O que NÃO muda

- Layout/cores dos elementos existentes
- Edge Functions / contratos de integração
- Fluxo de pagamento do cliente
- Lógica de `getComputedStatus`

