# Contingência PIX — AbacatePay (out/2026)

Desde 14/10/2026 a API PIX da Treeal (`api.pix.treeal.com`) responde `404` em todas as rotas.
Enquanto isso, novos QR Codes PIX são gerados pela **AbacatePay (API v2)**. A integração Treeal
(`treeal-*`, `_shared/treeal-auth.ts`) **não foi alterada** e volta a ser a principal após a normalização.

## Arquitetura

| Peça | Treeal (principal) | AbacatePay (contingência) |
|---|---|---|
| Gerar QR | `treeal-pix-create` | `abacatepay-pix-create` |
| Consultar status | `treeal-pix-status` | `abacatepay-pix-status` |
| Webhook | `treeal-webhook` | `abacatepay-webhook` |
| Sync cron (5 min) | `sync-treeal-status` | `sync-abacatepay-status` |
| Helpers | `_shared/treeal-auth.ts` | `_shared/abacatepay.ts` |

Todas as funções AbacatePay têm **o mesmo contrato** de request/response das equivalentes Treeal.

O front decide o provedor em [`src/lib/pixProvider.ts`](src/lib/pixProvider.ts):

- `ACTIVE_PIX_PROVIDER` — provedor usado para **gerar** novos QRs (padrão atual: `abacatepay`).
- `pixStatusFunctionFor(id)` — QRs já emitidos são sempre consultados no provedor que os gerou,
  identificado pelo formato do `mp_payment_id` (`pix_char_*` = AbacatePay; 32 hex = Treeal).
- Um QR Treeal pendente **não é reaproveitado** durante a contingência: a página gera um QR
  AbacatePay no mesmo split e grava o txid antigo em `mp_status_detail` para rastreabilidade.

## Ativação (uma vez)

1. **Chave de API** — painel AbacatePay → *Integração* → *Criar Chave*, em modo **Produção**,
   com as permissões `TRANSPARENT:CREATE` e `TRANSPARENT:READ` (permissões não podem ser editadas depois).
2. **Secrets** no Supabase (Edge Functions → Secrets):
   - `ABACATEPAY_API_KEY` — a chave acima (substitui a antiga, que está revogada).
   - `ABACATEPAY_WEBHOOK_SECRET` — string aleatória longa, a mesma usada na URL do webhook.
3. **Deploy** das funções: `abacatepay-pix-create`, `abacatepay-pix-status`, `abacatepay-webhook`,
   `sync-abacatepay-status`.
4. **Webhook** no painel AbacatePay (ou `POST /v2/webhooks/create`), evento `transparent.completed`
   (opcionalmente `transparent.refunded`, `transparent.lost`), endpoint:

   ```
   https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/abacatepay-webhook?webhookSecret=<ABACATEPAY_WEBHOOK_SECRET>
   ```

   O webhook nunca confia no payload: sempre reconsulta `GET /v2/transparents/check`.
5. **Cron**: aplicar a migration `supabase/migrations/20261015130000_cron_sync_abacatepay_status.sql`.
6. **Front**: deploy normal (Vercel). `pixProvider.ts` já aponta para `abacatepay`.

## Teste em Dev Mode

Com uma chave de **Dev**, os QRs vêm com `devMode: true` e podem ser pagos com
`POST /v2/transparents/simulate-payment?id=pix_char_...`. A função de criação registra um aviso
no log quando a chave é de Dev.

## Voltar para a Treeal

1. Em `src/lib/pixProvider.ts`, trocar `DEFAULT_PIX_PROVIDER` para `'treeal'` (ou buildar com
   `VITE_PIX_PROVIDER=treeal`) e fazer deploy do front.
2. Conferir/ajustar os secrets `TREEAL_API_URL` / `TREEAL_OAUTH_URL` se a Treeal mudou de endpoint.
3. Manter o cron `sync-abacatepay-status` ativo por **pelo menos 7 dias** (prazo dos QRs pendentes).
   Depois: `select cron.unschedule('sync-abacatepay-status-every-5min');`
4. As funções AbacatePay podem continuar publicadas: QRs antigos `pix_char_*` seguem sendo
   consultados nelas pelo roteamento por prefixo.

## Limites conhecidos

- Valor mínimo por PIX na AbacatePay: **R$ 1,00** (a função responde 400 abaixo disso).
- `customer` só é enviado quando há e-mail **e** telefone com 10/11 dígitos; sem isso o QR é
  emitido sem vínculo de pagador (qualquer pessoa pode pagar — mesmo comportamento da Treeal).
- A tarifa de 1,5 % continua sendo calculada no front, como antes.
