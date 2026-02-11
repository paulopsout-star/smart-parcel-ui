

# Substituir Mercado Pago pelo AbacatePay para PIX

## Resumo

Trocar o gateway de PIX de Mercado Pago para AbacatePay. O secret `ABACATEPAY_API_KEY` ja existe no Supabase. A API do AbacatePay e mais simples (2 endpoints principais vs 4 do MP).

## Mapeamento de APIs

```text
AbacatePay API (https://api.abacatepay.com/v1)
+------------------------------------------+-------------------------------------------+
| Mercado Pago (atual)                     | AbacatePay (novo)                         |
+------------------------------------------+-------------------------------------------+
| POST /v1/payments                        | POST /pixQrCode/create                    |
|   Auth: Bearer ACCESS_TOKEN              |   Auth: Bearer ABACATEPAY_API_KEY         |
|   Body: { transaction_amount, payer...}  |   Body: { amount, expiresIn, description, |
|   Resp: qr_code, qr_code_base64         |           customer? }                     |
|                                          |   Resp: { data: { id, brCode,             |
|                                          |           brCodeBase64, status, ...} }    |
+------------------------------------------+-------------------------------------------+
| GET /v1/payments/{id}                    | GET /pixQrCode/check?id={id}              |
|   Resp: status (approved/pending/...)    |   Resp: { data: { status: PAID/PENDING/   |
|                                          |           EXPIRED/CANCELLED/REFUNDED } }  |
+------------------------------------------+-------------------------------------------+
| Webhook HMAC-SHA256                      | Webhook (se disponivel, senao polling)    |
+------------------------------------------+-------------------------------------------+
```

## Arquivos a alterar

### 1. Edge Functions (Integracao - requer aprovacao)

**a) Reescrever `supabase/functions/mercadopago-pix-create/index.ts`**
- Trocar chamada de `api.mercadopago.com/v1/payments` para `api.abacatepay.com/v1/pixQrCode/create`
- Payload: `{ amount: amount_cents, expiresIn: 86400, description, customer: { name, email, taxId, cellphone } }`
- Mapear resposta: `data.brCode` -> `mp_qr_code`, `data.brCodeBase64` -> `mp_qr_code_base64`, `data.id` -> `mp_payment_id`
- Usar secret `ABACATEPAY_API_KEY` em vez de `MERCADOPAGO_ACCESS_TOKEN`

**b) Reescrever `supabase/functions/mercadopago-pix-status/index.ts`**
- Trocar chamada para `GET api.abacatepay.com/v1/pixQrCode/check?id={abacate_id}`
- Mapear status: `PAID` -> `concluded`, `PENDING` -> `pending`, `EXPIRED/CANCELLED` -> `failed`
- Manter mesma logica de atualizacao de splits e charges

**c) Reescrever `supabase/functions/sync-mercadopago-status/index.ts`**
- Mesma logica de buscar splits pendentes com `mp_payment_id`
- Trocar consulta de status para API AbacatePay

**d) Simplificar `supabase/functions/mercadopago-webhook/index.ts`**
- Adaptar para formato de webhook do AbacatePay (se suportado) ou manter apenas como fallback do polling

### 2. Frontend (Tela - requer aprovacao)

**a) `src/pages/CheckoutPix.tsx`** (3 chamadas)
- Nenhuma mudanca no nome da edge function chamada (o front chama a mesma function, so o backend muda)
- Campos de resposta continuam iguais (`qr_code`, `qr_code_base64`, `payment_id`, `status`)

**b) `src/pages/PaymentPix.tsx`** (3 chamadas)
- Mesma situacao: o contrato de resposta da edge function permanece identico

**c) `src/pages/ChargeHistory.tsx`** (1 chamada)
- Referencia a `sync-mercadopago-status` permanece igual (mesmo nome da function)

### 3. Contrato de resposta das Edge Functions (sem mudanca para o front)

As edge functions manterao o **mesmo contrato de resposta** para o frontend:
- `mercadopago-pix-create` retorna: `{ success, payment_id, qr_code, qr_code_base64, status, expiration, amount_cents }`
- `mercadopago-pix-status` retorna: `{ success, status, internal_status, pix_paid, pix_paid_at }`

Isso significa que o frontend NAO precisa de alteracao - apenas o backend (edge functions) muda.

### 4. Colunas do banco (sem mudanca)

Os campos `mp_payment_id`, `mp_qr_code`, `mp_qr_code_base64`, `mp_status`, etc. na tabela `payment_splits` serao reutilizados com os valores do AbacatePay. O prefixo "mp_" fica como legado, mas funcional.

## Mapeamento de Status

```text
AbacatePay     ->  Interno (payment_splits.status)
PENDING        ->  pending
PAID           ->  concluded
EXPIRED        ->  failed
CANCELLED      ->  failed
REFUNDED       ->  failed
```

## O que NAO muda

- Nenhuma pagina/UI e alterada
- Nenhuma coluna de banco e alterada
- Nenhum fluxo de navegacao muda
- A taxa PIX de 5% continua calculada da mesma forma
- Os nomes das edge functions permanecem os mesmos (evita mudar front + config.toml)
- O secret `ABACATEPAY_API_KEY` ja existe no Supabase

## Riscos

- O AbacatePay pode nao ter webhook nativo (nesse caso, dependemos 100% do polling + cron sync)
- A descricao do PIX no AbacatePay tem limite de 37 caracteres
- Necessario verificar se a chave `ABACATEPAY_API_KEY` ainda e valida/ativa

## Ordem de execucao

1. Atualizar as 4 edge functions (backend)
2. Testar criacao de PIX via edge function
3. Testar polling de status
4. Validar fluxo completo de checkout

