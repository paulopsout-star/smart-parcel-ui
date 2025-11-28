# 🛡️ Bloqueio WAF/CDN - API Cappta

## Problema Identificado

A API da Cappta (`api.cappta.com.br`) está protegida por um **WAF (Web Application Firewall)** da Akamai que está **bloqueando requisições** vindas dos Supabase Edge Functions.

### Evidências do Bloqueio

```
HTTP 403 Forbidden
Reference: errors.edgesuite.net
```

**Erro retornado:**
```html
<HTML><HEAD>
<TITLE>Access Denied</TITLE>
</HEAD><BODY>
<H1>Access Denied</H1>
You don't have permission to access "http://api.cappta.com.br/prepayment/authorize" on this server.
Reference #18.16f62917.1764342472.4cc3a29c
</BODY>
</HTML>
```

## Causas Prováveis

1. **IP Dinâmico Não Whitelistado**
   - Supabase Edge Functions usam IPs dinâmicos
   - WAF não reconhece a origem das requisições

2. **Headers Insuficientes ou Suspeitos**
   - User-Agent não reconhecido
   - Falta de headers esperados pelo WAF

3. **Rate Limiting**
   - Muitas requisições do mesmo range de IPs
   - Padrões de acesso considerados suspeitos

4. **Regras de Segurança Específicas**
   - Geo-blocking
   - Blacklist de ASNs/provedores cloud
   - Validações customizadas do WAF

## ✅ Soluções

### Solução 1: Whitelist de IPs (RECOMENDADA)

**Contatar Cappta** para adicionar os IPs do Supabase no whitelist do WAF.

**IPs do Supabase Edge Functions:**
- Consultar documentação oficial: https://supabase.com/docs/guides/functions/ip-addresses
- Ranges típicos incluem AWS us-east-1 (onde Edge Functions rodam)

**Informações para o Suporte:**
- Endpoint bloqueado: `/prepayment/authorize`
- Referência do erro: `errors.edgesuite.net`
- Origem: Supabase Edge Functions (AWS Lambda)

---

### Solução 2: Proxy com IP Fixo

Implementar um proxy intermediário com IP fixo:

```
[Supabase Edge Function] 
    ↓
[Proxy com IP Fixo] ← Whitelist no WAF
    ↓
[API Cappta]
```

**Opções de Proxy:**
- VPS dedicado (DigitalOcean, Linode, etc.)
- API Gateway (AWS API Gateway, Kong, etc.)
- Cloudflare Workers com IP fixo

**Exemplo de implementação:**

```typescript
// Proxy simples em Node.js
import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

app.post('/prepayment/authorize', async (req, res) => {
  const response = await fetch('https://api.cappta.com.br/prepayment/authorize', {
    method: 'POST',
    headers: {
      'Authorization': req.headers.authorization,
      'Content-Type': 'application/json',
      // Headers adicionais...
    },
    body: JSON.stringify(req.body)
  });
  
  const data = await response.text();
  res.status(response.status).send(data);
});

app.listen(3000);
```

---

### Solução 3: Headers Otimizados (PARCIAL)

Adicionar headers mais "realistas" para tentar passar pelo WAF:

```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Origin': 'https://api.cappta.com.br',
  'Referer': 'https://api.cappta.com.br/',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
}
```

⚠️ **Nota:** Esta solução pode não ser suficiente se o WAF bloqueia por IP.

---

### Solução 4: Ambiente de Homologação

Solicitar à Cappta um **ambiente de homologação/sandbox** sem WAF para testes de integração.

---

## 📊 Teste de Conectividade

Use a página `/admin/connectivity-test` para:
- Testar obtenção de token
- Verificar bloqueio do WAF
- Visualizar resposta completa da API
- Acompanhar logs em tempo real

---

## 🔍 Debug Adicional

### Verificar IPs do Supabase

```bash
# Fazer requisição através da edge function
curl -X POST https://<seu-projeto>.supabase.co/functions/v1/quitaplus-token
```

### Logs Detalhados

A edge function `quitaplus-prepayment` já registra:
- Request completo (URL, method, headers, body mascarado)
- Response completo (status, headers, body)
- Detecção automática de bloqueio WAF

---

## 📞 Contatos

**Suporte Cappta:**
- Solicitar whitelist de IPs
- Informar sobre bloqueio do WAF
- Requisitar ambiente de sandbox

**Documentação Supabase:**
- Edge Functions IPs: https://supabase.com/docs/guides/functions/ip-addresses

---

## 📝 Status Atual

- ✅ Token obtido com sucesso
- ❌ Pré-pagamento bloqueado por WAF (403)
- ❌ Vínculo de boleto pendente (aguarda pré-pagamento)
- 🔄 Aguardando whitelist de IPs ou implementação de proxy
