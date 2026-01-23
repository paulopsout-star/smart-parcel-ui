
## Plano: Incluir Cobrancas Terminais na Sincronizacao com Limite de Tentativas

### Objetivo

Modificar o sistema de sincronizacao para:
1. Re-verificar cobrancas com status terminal (`failed`, `expired`) das ultimas 48h
2. Limitar a 5 tentativas de re-verificacao antes de parar de sincronizar

---

### Alteracoes no Banco de Dados

#### 1. Adicionar campo `sync_attempts` na tabela `charges`

```sql
ALTER TABLE charges 
ADD COLUMN sync_attempts integer DEFAULT 0;

COMMENT ON COLUMN charges.sync_attempts IS 
  'Contador de tentativas de sincronizacao sem mudanca de status. Apos 5 tentativas, para de re-verificar.';
```

Este campo:
- Inicia em 0
- Incrementa cada vez que a API retorna o mesmo status terminal
- Reseta para 0 quando o status muda
- Quando atinge 5, a cobranca nao e mais verificada

---

### Alteracoes no Edge Function `sync-payment-status`

#### 1. Adicionar query para cobrancas terminais recentes (linhas 46-75)

```text
ANTES:
- Busca apenas cobrancas NAO terminais
- Filtro: .not("status", "in", '("completed","cancelled","payment_denied","failed")')

DEPOIS:
- Busca 1: Cobrancas nao terminais (atual)
- Busca 2: Cobrancas terminais das ultimas 48h COM sync_attempts < 5
- Combina ambas as listas (sem duplicatas)
```

#### 2. Logica de incremento/reset do contador

```text
┌─────────────────────────────────────────────────────────────────┐
│              FLUXO DE SINCRONIZACAO ATUALIZADO                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   API Quita+ retorna status                                     │
│           │                                                     │
│           ▼                                                     │
│   ┌───────────────────┐                                         │
│   │ Status mudou?     │                                         │
│   └───────────────────┘                                         │
│           │                                                     │
│     ┌─────┴─────┐                                               │
│     │           │                                               │
│    SIM         NAO                                              │
│     │           │                                               │
│     ▼           ▼                                               │
│ ┌─────────┐ ┌──────────────────┐                                │
│ │ Atualiza│ │ sync_attempts++  │                                │
│ │ status  │ └──────────────────┘                                │
│ │         │          │                                          │
│ │ Reset   │          ▼                                          │
│ │ sync_   │ ┌──────────────────┐                                │
│ │ attempts│ │ sync_attempts >=5│                                │
│ │ = 0     │ └──────────────────┘                                │
│ └─────────┘          │                                          │
│                      ▼                                          │
│             ┌────────────────────────────┐                      │
│             │ NAO verificar mais         │                      │
│             │ (limite de tentativas)     │                      │
│             └────────────────────────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Codigo Detalhado das Alteracoes

#### Arquivo: `supabase/functions/sync-payment-status/index.ts`

**Secao 1: Adicionar busca de cobrancas terminais (apos linha 55)**

```typescript
// Buscar cobrancas terminais das ultimas 48h com sync_attempts < 5
const twoDaysAgo = new Date();
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
const twoDaysAgoISO = twoDaysAgo.toISOString();

const { data: terminalCharges, error: terminalError } = await supabase
  .from("charges")
  .select("id, pre_payment_key, status, company_id, payer_name, amount, boleto_linked_at, completed_at, sync_attempts")
  .not("pre_payment_key", "is", null)
  .in("status", ["failed", "expired"])
  .lt("sync_attempts", 5)  // Limitar a 5 tentativas
  .gte("created_at", twoDaysAgoISO)
  .order("created_at", { ascending: false })
  .limit(10);

// Combinar listas sem duplicatas
const allCharges = [...(charges || [])];
if (terminalCharges) {
  for (const tc of terminalCharges) {
    if (!allCharges.find(c => c.id === tc.id)) {
      allCharges.push(tc);
    }
  }
}

console.log(`[sync-payment-status] Total: ${allCharges.length} (${charges?.length || 0} ativos + ${terminalCharges?.length || 0} terminais)`);
```

**Secao 2: Modificar logica de atualizacao (linhas 156-217)**

```typescript
// Verificar se precisa atualizar
if (newStatus !== charge.status) {
  // STATUS MUDOU - atualizar e resetar contador
  const updateData: Record<string, unknown> = {
    status: newStatus,
    sync_attempts: 0,  // RESET contador
    updated_at: new Date().toISOString(),
  };
  
  // ... resto do codigo de atualizacao ...
  
} else {
  // STATUS NAO MUDOU - incrementar contador SE for terminal
  const isTerminal = ["failed", "expired", "cancelled", "payment_denied"].includes(charge.status);
  
  if (isTerminal) {
    const currentAttempts = (charge as any).sync_attempts || 0;
    await supabase
      .from("charges")
      .update({ 
        sync_attempts: currentAttempts + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", charge.id);
    
    console.log(`[sync-payment-status] Charge ${charge.id} manteve status ${charge.status}, tentativa ${currentAttempts + 1}/5`);
  }
  
  results.push({
    chargeId: charge.id,
    oldStatus: charge.status,
    newStatus,
    apiStatusCode,
    updated: false,
  });
}
```

---

### Arquivos Alterados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/sync-payment-status/index.ts` | Adicionar busca de terminais, logica de sync_attempts |
| Banco de dados (migracao) | Adicionar coluna `sync_attempts` |

---

### Exemplo de Comportamento

| Dia | Status DB | Status API | sync_attempts | Acao |
|-----|-----------|------------|---------------|------|
| 1 | failed | failed | 0 → 1 | Incrementa contador |
| 1 | failed | failed | 1 → 2 | Incrementa contador |
| 2 | failed | failed | 2 → 3 | Incrementa contador |
| 2 | failed | failed | 3 → 4 | Incrementa contador |
| 3 | failed | failed | 4 → 5 | Incrementa, atinge limite |
| 3+ | failed | - | 5 | NAO verifica mais |

Se em algum momento a API retornar status diferente:
| Dia | Status DB | Status API | sync_attempts | Acao |
|-----|-----------|------------|---------------|------|
| 1 | failed | failed | 0 → 1 | Incrementa contador |
| 2 | failed | boleto_linked | 1 → 0 | ATUALIZA, reseta contador |

---

### Criterios de Aceite

1. Campo `sync_attempts` adicionado na tabela `charges`
2. Cobrancas `failed`/`expired` das ultimas 48h sao re-verificadas
3. Contador incrementa a cada verificacao sem mudanca
4. Contador reseta quando status muda
5. Cobrancas com `sync_attempts >= 5` nao sao mais verificadas
6. Logs indicam tentativa X/5 para cada cobranca terminal
7. Nenhuma funcionalidade existente removida
