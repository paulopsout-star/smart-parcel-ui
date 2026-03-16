
Objetivo: eliminar o 5% que ainda aparece no checkout PIX e impedir que splits antigos/incorretos continuem sendo reutilizados.

Resumo do que confirmei:
- No código atual, os pontos principais de PIX já estão em 1,5%:
  - `src/pages/CheckoutPix.tsx` → `PIX_FEE_PERCENT = 0.015`
  - `src/components/CombinedCheckoutSummary.tsx` → `0.015`
  - `src/pages/NewCharge.tsx` → novas cobranças PIX salvam `fee_amount = 0` e `fee_percentage = 0`
- No banco, a cobrança PIX mais recente (`05dc9bf0...`) foi criada corretamente com:
  - `amount = 1000`
  - `fee_amount = 0`
  - `fee_percentage = 0`
- Mas o split PIX dessa mesma cobrança foi criado incorretamente com:
  - `amount_cents = 1000`
  - `display_amount_cents = 1050`
Isso prova que o valor errado ainda está entrando em `payment_splits` em runtime.

Causa mais provável:
- Não encontrei mais 5% no fluxo principal de PIX do repositório.
- Então o problema real agora parece ser uma combinação de:
  1. bundle/runtime antigo ainda em uso no checkout publicado/custom domain; e/ou
  2. reaproveitamento cego de split pendente já salvo com 5%.

Plano de correção:
1. Blindar `src/pages/CheckoutPix.tsx`
- Antes de reaproveitar split existente, calcular o total esperado:
  - `expectedBase = charge.amount`
  - `expectedTotal = expectedBase + round(expectedBase * 0.015)`
- Se o split pendente tiver `display_amount_cents` diferente do esperado:
  - não confiar nele;
  - limpar os metadados PIX antigos (`mp_payment_id`, `mp_qr_code`, `mp_qr_code_base64`, `mp_status`, expiração);
  - corrigir `amount_cents/display_amount_cents`;
  - gerar um novo QR com o valor correto.
- Isso evita que um split “contaminado” continue mostrando R$ 10,50.

2. Aplicar a mesma proteção em `src/pages/PaymentPix.tsx`
- Esse fluxo também reutiliza `display_amount_cents || amount_cents`.
- Vou adicionar a mesma validação para não exibir nem reenviar um split pendente salvo com taxa errada.

3. Corrigir dados existentes no banco
- A migration anterior ajusta só `display_amount_cents`, mas isso não basta quando já existe `mp_payment_id`/QR gerado.
- Vou criar uma nova migration para pendências PIX com padrão de 5%:
  - recalcular `display_amount_cents` para `ROUND(amount_cents * 1.015)`
  - limpar os campos `mp_*`
- Assim o checkout regenera o QR no valor certo, em vez de continuar reapresentando um QR de R$ 10,50.

4. Ajuste preventivo no fluxo combinado
- Revisar `src/pages/Checkout.tsx`, porque hoje o split PIX combinado ainda está persistindo:
  - `amount_cents: pixTotalCents`
  - `display_amount_cents: pixTotalCents`
- O correto é manter base e exibição separados para evitar novas distorções:
  - `amount_cents = valor base do PIX`
  - `display_amount_cents = valor com 1,5%`
- Não é a causa principal desta cobrança pura via PIX, mas é um risco de inconsistência futura.

5. Validar após deploy
- Criar uma cobrança PIX nova de R$ 10,00
- Confirmar no banco:
  - `charges.amount = 1000`
  - `payment_splits.amount_cents = 1000`
  - `payment_splits.display_amount_cents = 1015`
- Confirmar no checkout:
  - valor exibido = R$ 10,15
- Confirmar que reabrir o mesmo link não volta a mostrar R$ 10,50

Detalhe técnico importante:
- Corrigir só a UI não resolve.
- Corrigir só `display_amount_cents` também não resolve se o QR antigo já foi criado.
- A correção precisa tratar juntos:
  1. frontend que valida o split,
  2. banco que limpa o split pendente incorreto,
  3. regeneração do QR com o valor de 1,5%.
