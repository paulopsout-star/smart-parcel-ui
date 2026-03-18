

## Plano: Alterar limite de parcelas de 12 para 21

### Alteração única

**Arquivo:** `supabase/functions/quitaplus-prepayment/index.ts` (linha 111)

Alterar a validação de parcelas:
- **De:** `requestData.installments > 12`
- **Para:** `requestData.installments > 21`

Atualizar também a mensagem de erro correspondente (linha 114):
- **De:** `'O número de parcelas deve estar entre 1 e 12'`
- **Para:** `'O número de parcelas deve estar entre 1 e 21'`

Além disso, alterar o retorno de erro de `status: 400` para `status: 200` com `success: false`, conforme o padrão de error reporting das edge functions (evita erro genérico "non-2xx" no frontend).

