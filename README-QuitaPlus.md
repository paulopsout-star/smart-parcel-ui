# QuitaPlus Integration

## Visão Geral

Esta integração implementa um sistema completo de pagamentos usando a API QuitaPlus (Cappta), com proxy backend para segurança e autenticação automática.

## Arquitetura

### Backend (Supabase Edge Functions)

1. **`quitaplus-token`** (`/functions/v1/quitaplus-token`)
   - Obtém e cacheia tokens de acesso OAuth2
   - Implementa retry/backoff para erros 429/5xx
   - Cache inteligente com buffer de expiração

2. **`quitaplus-proxy`** (`/functions/v1/quitaplus-proxy`)
   - Proxy transparente para todas as chamadas QuitaPlus
   - Injeta automaticamente `Authorization: Bearer <token>`
   - Retry/backoff automático para falhas

### Frontend

- **`useQuitaMais`**: Hook React para interação com a API
- Todas as chamadas passam pelo proxy backend
- Zero exposição de credenciais no browser

## Configuração de Ambiente

### Secrets do Supabase (obrigatórios)

```bash
# Base URL da API
QUITAPLUS_BASE_URL=https://api-sandbox.cappta.com.br  # sandbox
# QUITAPLUS_BASE_URL=https://api.cappta.com.br         # produção

# Credenciais OAuth2
QUITAPLUS_CLIENT_ID=seu_client_id
QUITAPLUS_CLIENT_SECRET=seu_client_secret
```

### Como configurar os secrets

1. Acesse o painel do Supabase
2. Vá em Project Settings > Edge Functions
3. Adicione os secrets acima

## Endpoints da API

### Autenticação
- **Endpoint**: `https://api-sandbox.cappta.com.br/connect/token`
- **Método**: POST
- **Content-Type**: `application/x-www-form-urlencoded`
- **Body**: `grant_type=client_credentials&client_id=X&client_secret=Y`

### Funcionalidades

1. **Teste de conectividade**
   ```typescript
   const isConnected = await testConnectivity()
   ```

2. **Criar link de pagamento**
   ```typescript
   const link = await createPaymentLink({
     amount: 10000, // em centavos
     payer: { name: "João", email: "joao@email.com", ... },
     checkout: { maskFee: true, installments: 12 }
   })
   ```

3. **Buscar detalhes do link**
   ```typescript
   const details = await getPaymentLinkDetails(linkId)
   ```

## Testes com cURL

### 1. Testar obtenção de token

```bash
curl -X POST https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/quitaplus-token \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Resposta esperada:**
```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "expiresAt": 1640995200000,
  "fromCache": false
}
```

### 2. Testar proxy (exemplo de endpoint hipotético)

```bash
curl -X GET https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/quitaplus-proxy/payment-links \
  -H "Content-Type: application/json"
```

### 3. Criar link de pagamento via proxy

```bash
curl -X POST https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/quitaplus-proxy/payment-links \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "payer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "phoneNumber": "11999999999",
      "document": "12345678901"
    },
    "checkout": {
      "maskFee": true,
      "installments": 12
    }
  }'
```

## Retry Logic e Error Handling

### Códigos de Status Tratados

- **429 (Rate Limit)**: Retry com `Retry-After` header ou backoff exponencial
- **5xx (Server Errors)**: Retry com backoff exponencial
- **4xx (Client Errors)**: Sem retry, retorna erro imediatamente

### Backoff Strategy

```
Tentativa 1: Imediato
Tentativa 2: 2^1 = 2 segundos
Tentativa 3: 2^2 = 4 segundos
Máximo: 3 tentativas
```

## Checklist de Aceite

### ✅ Funcionalidades Básicas
- [ ] Obtenção de token OAuth2 funciona
- [ ] Cache de token está operacional
- [ ] Proxy injeta Authorization header automaticamente
- [ ] Teste de conectividade passa
- [ ] Criação de link de pagamento funciona
- [ ] Busca de detalhes do link funciona

### ✅ Segurança
- [ ] Nenhuma credencial exposta no frontend
- [ ] Todas as chamadas passam pelo proxy backend
- [ ] Tokens são cachados com segurança no backend
- [ ] CORS configurado corretamente

### ✅ Resilência
- [ ] Retry automático para 429/5xx
- [ ] Backoff exponencial implementado
- [ ] Cache de token com buffer de expiração
- [ ] Logs detalhados para debugging

### ✅ Testes
- [ ] cURL para token funciona
- [ ] cURL para proxy funciona
- [ ] Interface de usuário funciona
- [ ] Mensagens de erro são claras

### ✅ Ambientes
- [ ] Sandbox configurado e testado
- [ ] Secrets de produção documentados
- [ ] Processo de deploy documentado

## Logs e Debugging

### Ver logs das Edge Functions

1. **Token Function**: https://supabase.com/dashboard/project/gsbbrkbeyxsqqjqhptrn/functions/quitaplus-token/logs
2. **Proxy Function**: https://supabase.com/dashboard/project/gsbbrkbeyxsqqjqhptrn/functions/quitaplus-proxy/logs

### Logs Importantes

- ✅ `Token obtained successfully`
- ✅ `Using cached token`
- ✅ `Proxy response: 200 for https://...`
- ❌ `Request failed with 429, retrying in Xms`
- ❌ `All retry attempts failed`

## Migração da Versão Anterior

### Removido
- ❌ `quitamais-auth` function (substituída por `quitaplus-token`)
- ❌ Chamadas diretas do browser para Cappta
- ❌ Múltiplos endpoints de teste de OAuth

### Adicionado
- ✅ `quitaplus-token` - gestão centralizada de tokens
- ✅ `quitaplus-proxy` - proxy transparente com auth
- ✅ Cache inteligente de tokens
- ✅ Retry/backoff robusto
- ✅ Logs estruturados

## Troubleshooting

### Erro: "Missing QUITAPLUS_CLIENT_ID"
- Verifique se os secrets estão configurados no Supabase
- Confirme os nomes exatos: `QUITAPLUS_CLIENT_ID`, `QUITAPLUS_CLIENT_SECRET`

### Erro: "Authentication failed"
- Verifique se as credenciais estão corretas
- Confirme se o ambiente (sandbox/prod) está correto
- Verifique logs da função `quitaplus-token`

### Erro: "Proxy error"
- Verifique se o endpoint QuitaPlus existe
- Confirme se o path do proxy está correto
- Verifique logs da função `quitaplus-proxy`

### Rate Limiting (429)
- Sistema automaticamente faz retry
- Verifique logs para confirmar backoff
- Considere reduzir frequência de requests se persistir

## Links Úteis

- [Supabase Edge Functions](https://supabase.com/dashboard/project/gsbbrkbeyxsqqjqhptrn/functions)
- [Edge Functions Secrets](https://supabase.com/dashboard/project/gsbbrkbeyxsqqjqhptrn/settings/functions)
- [Documentação QuitaPlus/Cappta](https://developers.cappta.com.br/) (se disponível)