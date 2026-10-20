# Banco Inter — emissão automática do boleto do cartão

Nos pagamentos combinados (PIX + Cartão), o cartão pré-autorizado no Quita+ precisa de um boleto
vinculado com o **valor exato do cartão**. Hoje o admin emite esse boleto no Inter e cola a linha
digitável. Esta integração emite o boleto pela API de Cobrança v3 do Inter e vincula sozinha.

## Peças

| Onde | O quê |
|---|---|
| `supabase/functions/_shared/inter.ts` | Cliente: token OAuth2 (client_credentials) sobre mTLS, emitir, consultar, cancelar, webhook |
| `supabase/functions/inter-health` | Diagnóstico (admin): secrets, token, webhook cadastrado |
| `supabase/functions/inter-boleto-issue` | Emite boleto com o valor do split de cartão e vincula no Quita+ (`quitaplus-link-boleto`) |
| `supabase/functions/inter-webhook` | Recebe callbacks do Inter, relê a cobrança e grava `metadata.inter_cobranca` |
| `quitaplus-prepayment` | Com `INTER_AUTO_ISSUE=true`, dispara a emissão logo após a pré-autorização |
| Tela de detalhes (admin) | Botão "Emitir no Inter e vincular" ao lado do vínculo manual |

Fluxo: cartão Received (1) → `inter-boleto-issue` → POST cobrança (assíncrono, devolve
`codigoSolicitacao`) → poll até sair de `EM_PROCESSAMENTO` → `boleto.linhaDigitavel` →
`AttachBankslip` no Quita+ → cobrança `boleto_linked`. Se o vínculo falhar, o boleto é cancelado
no Inter e o erro fica em `metadata.inter_cobranca.link_error`.

## Secrets (Supabase → Edge Functions → Secrets)

| Secret | Valor |
|---|---|
| `INTER_CLIENT_ID` / `INTER_CLIENT_SECRET` | da aplicação cadastrada no Internet Banking PJ |
| `INTER_CERT` | certificado da aplicação (`.crt`) em **base64** (ou o PEM puro) |
| `INTER_KEY` | chave privada (`.key`) em **base64** (ou o PEM puro) |
| `INTER_ENV` | `sandbox` (padrão) ou `production` |
| `INTER_CONTA_CORRENTE` | só se a aplicação enxerga mais de uma conta |
| `INTER_PAGADOR_ENDERECO` | JSON `{"endereco":"...","bairro":"...","cidade":"...","uf":"UF","cep":"00000000"}` — a API exige endereço do pagador e a cobrança não guarda endereço; usa-se o da empresa |
| `INTER_WEBHOOK_TOKEN` | string aleatória; a URL cadastrada no Inter leva `?token=` |
| `INTER_AUTO_ISSUE` | `true` para emitir automaticamente na pré-autorização (deixar vazio até validar) |

Gerar o base64 no Windows (PowerShell), na pasta dos arquivos:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\certificado.crt")) | Set-Clipboard   # cola em INTER_CERT
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\chave.key")) | Set-Clipboard         # cola em INTER_KEY
```

Atenção: o par **certificado + chave da aplicação** vem de *Minhas Integrações → Ações → Baixar
chave e certificado* (download único). O "Certificado Webhook" que o portal oferece é outra coisa:
é o certificado do Inter para validar callbacks e **não** serve para autenticar na API.

## Validação

1. `inter-health` (admin, via Authorization do usuário) → `ok: true`, `token.ok: true`.
2. No sandbox: abrir uma cobrança combinada com cartão pré-autorizado e clicar em
   "Emitir no Inter e vincular". Conferir `metadata.inter_cobranca` e o status `boleto_linked`.
3. Cadastrar o webhook: `PUT /cobranca/v3/cobrancas/webhook` com
   `{SUPABASE_URL}/functions/v1/inter-webhook?token=...` (há `setWebhook` no cliente).
4. Trocar `INTER_ENV=production`, repetir 2 com uma cobrança real, só então `INTER_AUTO_ISSUE=true`
   e redeploy de `quitaplus-prepayment`.

## Limites conhecidos

- Token: 5 pedidos/min, validade 1 h (cacheado por isolate). Cobrança: 120 chamadas/min.
- Vencimento no mesmo dia só até 19:59 (o cliente usa amanhã a partir das 19:00).
- Valor mínimo R$ 2,50. Pagador precisa de CPF/CNPJ e endereço completo.
- Certificado da aplicação vale 1 ano — renovar no Internet Banking e atualizar os secrets.
- Nomes de campos/caminhos vieram de SDKs públicos; a referência oficial é
  https://developers.inter.co/references/cobranca-bolepix (confirmar no sandbox).
