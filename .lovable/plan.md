
# Executar Atualização de Cobrança e Gerar Link - JOAO VITOR ALVES DE ARAUJO

## O que será feito

### Passo 1: Criar Edge Function Temporária
Criar `supabase/functions/update-charge-exception/index.ts` que executa o UPDATE da cobrança com valores especiais:
- **Charge ID:** `cabb7b7b-3a7b-4294-ac4d-1723c81df6fe` (JOAO VITOR ALVES DE ARAUJO)
- **Novo Total:** R$ 15.250,00 (1.525.000 centavos)
- **Novo Fee:** R$ 250,00 (25.000 centavos)
- **Taxa (%):** 1,67%
- **Valor Original (sem juros):** R$ 15.000,00 (1.500.000 centavos)

### Passo 2: Executar a Atualização
Chamar a Edge Function via curl para fazer o UPDATE no banco de dados.

### Passo 3: Gerar Link de Checkout
Após a atualização, usar a API existente `charge-links` para gerar um novo link de checkout com os valores atualizados:
```
POST /charge-links
Body: {
  chargeId: "cabb7b7b-3a7b-4294-ac4d-1723c81df6fe",
  action: "create"
}
```

## Resultado esperado

- ✅ Cobrança atualizada no banco: total = 1.525.000 cents, fee = 25.000 cents
- ✅ Link de checkout gerado: `https://pay1.autonegocie.com/checkout/{link_id}`
- ✅ Cliente JOAO VITOR Alves de Araújo com nova taxa especial aplicada

## O que NÃO muda

- Nenhuma alteração em layouts, componentes ou UIbehavior
- Nenhuma mudança em RLS policies ou segurança
- Apenas 1 registro específico alterado no banco (exceção comercial)
