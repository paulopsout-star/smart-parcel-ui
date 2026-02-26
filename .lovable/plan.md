

# Plano: Adicionar valor 'refunded' ao enum `charge_status`

## Problema

O erro `invalid input value for enum charge_status: "refunded"` ocorre porque o valor `refunded` foi adicionado como opção no frontend, mas **não existe no enum `charge_status` do banco de dados**.

## Mudança

### Migração SQL

Adicionar o valor `refunded` ao enum `charge_status`:

```sql
ALTER TYPE charge_status ADD VALUE IF NOT EXISTS 'refunded';
```

Nenhuma mudança no frontend — o código já está correto.

