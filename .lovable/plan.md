
## Plano: Corrigir Sistema de Sincronizacao de Status de Pagamentos

### Problemas Identificados

1. **pg_cron NAO HABILITADO**: Nao existe sincronizacao automatica
2. **Mapeamento ERRADO do StatusCode 3**: `sync-card-status` e `conclude-card-payment` mapeiam `3 -> expired` quando deveria ser `boleto_linked`
3. **Filtro exclui cobrancas terminais**: Cobrancas erroneamente marcadas como `failed` nunca sao re-verificadas
4. **Janela de 7 dias**: `sync-card-status` ignora cobrancas mais antigas

---

### Alteracoes Necessarias

#### 1. Corrigir Mapeamento em `sync-card-status`

**Arquivo:** `supabase/functions/sync-card-status/index.ts`

**Linha 10-21 - Antes:**
```typescript
const statusCodeMap: Record<number, string> = {
  1: 'pending',
  2: 'cancelled',
  3: 'expired',        // ❌ ERRADO
  ...
};
```

**Depois:**
```typescript
const statusCodeMap: Record<number, string> = {
  1: 'pending',
  2: 'cancelled',
  3: 'boleto_linked',  // ✅ BarcodeAssigned = boleto vinculado
  ...
};
```

---

#### 2. Corrigir Mapeamento em `conclude-card-payment`

**Arquivo:** `supabase/functions/conclude-card-payment/index.ts`

**Linha 11-22 - Antes:**
```typescript
const statusCodeMap: Record<number, string> = {
  1: 'analyzing',
  2: 'cancelled',
  3: 'expired',        // ❌ ERRADO
  ...
};
```

**Depois:**
```typescript
const statusCodeMap: Record<number, string> = {
  1: 'analyzing',
  2: 'cancelled',
  3: 'boleto_linked',  // ✅ BarcodeAssigned = boleto vinculado
  ...
};
```

---

#### 3. Habilitar pg_cron e Criar Job Automatico

**Executar no SQL Editor do Supabase:**

```sql
-- 1. Habilitar extensoes necessarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Criar job para sync-payment-status (a cada 5 minutos)
SELECT cron.schedule(
  'sync-payment-status-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/sync-payment-status',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body:='{"cron": true}'::jsonb
  ) as request_id;
  $$
);

-- 3. Criar job para sync-card-status (a cada 5 minutos)
SELECT cron.schedule(
  'sync-card-status-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/sync-card-status',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body:='{"cron": true}'::jsonb
  ) as request_id;
  $$
);

-- 4. Criar job para sync-mercadopago-status (a cada 5 minutos)
SELECT cron.schedule(
  'sync-mercadopago-status-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/sync-mercadopago-status',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body:='{"cron": true}'::jsonb
  ) as request_id;
  $$
);
```

---

#### 4. Correcao Imediata dos Dados da Anne Caroline

**Executar no SQL Editor:**

```sql
-- Corrigir payment_split
UPDATE payment_splits 
SET status = 'boleto_linked', processed_at = NULL
WHERE id = 'e122bd6c-4622-42b6-a1b8-b429cb70bb3f';

-- Corrigir charge
UPDATE charges 
SET status = 'boleto_linked', updated_at = NOW()
WHERE id = 'bfac1596-dc46-4164-b7c4-e39f4dd46cda';
```

---

#### 5. (Opcional) Adicionar Re-sync de Cobrancas Terminais

Para evitar que cobrancas erroneamente marcadas nunca sejam re-verificadas, adicionar uma verificacao periodica que inclua status terminais recentes.

**Adicionar em `sync-payment-status`:**

```typescript
// Buscar tambem cobrancas failed/expired das ultimas 48h para re-verificar
const { data: recentTerminal } = await supabase
  .from("charges")
  .select("id, pre_payment_key, status, company_id, payer_name")
  .not("pre_payment_key", "is", null)
  .in("status", ["failed", "expired"])
  .gte("created_at", twoDaysAgo)
  .limit(10);
```

---

### Arquivos Alterados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/sync-card-status/index.ts` | Corrigir statusCode 3 para `boleto_linked` |
| `supabase/functions/conclude-card-payment/index.ts` | Corrigir statusCode 3 para `boleto_linked` |

### Acoes Manuais Necessarias

| Acao | Responsavel |
|------|-------------|
| Habilitar pg_cron e pg_net no Dashboard Supabase | Admin |
| Criar os 3 cron jobs via SQL | Admin |
| Corrigir dados da Anne Caroline | Admin |

---

### Criterios de Aceite

1. Mapeamento do StatusCode 3 = `boleto_linked` em todas as edge functions
2. pg_cron executando sync a cada 5 minutos
3. Dados da Anne Caroline corrigidos para `boleto_linked`
4. Logs mostram sincronizacao automatica funcionando
5. Cobrancas com StatusCode 3 na API nao sao mais marcadas como `expired`
