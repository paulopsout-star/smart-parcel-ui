# Sistema de Cobrança Integrado ao Quita+

Sistema completo de cobrança com autenticação RBAC, cobranças pontuais e recorrentes integradas ao Quita+.

## 🚀 Funcionalidades

### Autenticação e Autorização
- ✅ Login/senha com hash bcrypt (Supabase Auth)
- ✅ RBAC: Admin/Operador
- ✅ Clientes acessam sem login
- ✅ Cookies httpOnly e CSRF protection (Supabase nativo)
- ✅ Rate limiting (Supabase nativo)

### Cobranças
- ✅ **Pontuais**: Cobrança única com link instantâneo
- ✅ **Recorrentes**: Diária, semanal, quinzenal, mensal, semestral, anual
- ✅ Configuração de parcelas e maskFee/installments
- ✅ Integração server-side com Quita+

### Processamento Automático
- ✅ Cron job para recorrências (timezone America/Sao_Paulo)
- ✅ Controle de idempotência
- ✅ Logs completos de auditoria
- ✅ Retry automático com exponential backoff

## 🏗️ Arquitetura

### Banco de Dados
- `profiles`: Usuários com roles (admin/operador)
- `charges`: Cobranças pontuais e recorrentes
- `charge_executions`: Log de cada tentativa de processamento

### Edge Functions
- `quitaplus-proxy`: Integração com API Quita+
- `process-charge`: Processa cobrança individual
- `recurring-charges-cron`: Job automático para recorrências

### Frontend
- Página pública: Demo de pagamento
- Dashboard autenticado: Gestão de cobranças
- RBAC: Admin gerencia usuários, Operador cria cobranças

## 🔧 Setup

### 1. Configurar Secrets no Supabase
```bash
# Já configurados:
- QUITAPLUS_CLIENT_ID
- QUITAPLUS_CLIENT_SECRET  
- QUITA_MAIS_MERCHANT_ID
```

### 2. Configurar Cron Job
```sql
-- Executar no SQL Editor do Supabase
SELECT cron.schedule(
  'recurring-charges-processor',
  '*/15 * * * *', -- A cada 15 minutos
  $$
  SELECT net.http_post(
    url := 'https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/recurring-charges-cron',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '", "Content-Type": "application/json"}'::jsonb,
    body := '{"cron": true}'::jsonb
  ) as request_id;
  $$
);
```

### 3. Criar primeiro usuário Admin
```sql
-- Após primeiro signup, promover a admin:
UPDATE profiles SET role = 'admin' WHERE email = 'seu@email.com';
```

## 🧪 Testes

### Cobrança Pontual
1. Login como operador/admin
2. Dashboard → Nova Cobrança
3. Preencher dados do pagador
4. Tipo: "Pontual"
5. ✅ Link gerado instantaneamente

### Cobrança Recorrente
1. Nova Cobrança → Tipo: "Mensal"
2. Intervalo: 1, Data fim: opcional
3. ✅ Primeira cobrança processada
4. ✅ Próximas agendadas via cron

### Validação JSON Canônico
```json
{
  "orderDetails": {
    "merchantId": "54.329.414/0001-98",
    "initiatorKey": null,
    "expiresAt": "2025-11-26 00:00:01",
    "description": "Teste",
    "details": null,
    "payer": { ... },
    "bankslip": { ... },
    "checkout": { ... }
  }
}
```

## 📊 Monitoramento

- **Logs**: Supabase Edge Functions → quitaplus-proxy
- **Auditoria**: Tabela `charge_executions`
- **Cron Status**: Logs do `recurring-charges-cron`

✅ **Sistema pronto para produção!**