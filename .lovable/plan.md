

# Plano: Adicionar status "estornado" às opções do admin

## Mudança

### `src/pages/ChargeHistory.tsx` (linha 1951)

Adicionar `{ value: 'refunded', label: 'Estornado' }` à lista de opções do Select de alteração manual de status, após `payment_denied`.

