

# Plano: Corrigir exibição do status "Estornado"

## Problema

Duas falhas impedem a exibição correta do status `refunded`:

1. **`getModernStatusBadge`** (linha ~227): o mapa de configs não inclui `refunded`, então o fallback na linha 229 (`|| configs.pending`) exibe "Pendente".

2. **`getComputedStatus`** (linha ~141): para cobranças `cartao_pix`, a função recalcula o status a partir dos splits, ignorando que o admin alterou manualmente o status (com `status_locked_at`). Para cobranças não-combinadas, retorna `charge.status` corretamente.

## Mudanças em `src/pages/ChargeHistory.tsx`

### 1. Adicionar `refunded` ao mapa de `getModernStatusBadge`

Após `cnpj_nao_cadastrado` (~linha 226), adicionar:

```ts
refunded: {
  label: 'Estornado',
  variant: 'destructive' as const
},
```

### 2. Respeitar `status_locked_at` em `getComputedStatus`

No início da função (linha ~141), antes de qualquer lógica de splits, adicionar:

```ts
// Se o admin travou o status manualmente, respeitar sempre
if (charge.status_locked_at) {
  return charge.status;
}
```

Isso garante que qualquer status definido manualmente pelo admin (refunded, cancelled, etc.) nunca seja sobrescrito pela lógica de splits.

## O que NÃO muda

- Nenhum layout, cor ou componente existente
- Nenhuma integração ou edge function
- Lógica de splits para cobranças sem lock manual

