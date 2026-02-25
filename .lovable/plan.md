

# Diagnóstico: "Vinculando..." trava e não conclui

## Causa Raiz

Dois problemas combinados fazem o botão ficar eternamente em "Vinculando...":

### 1. Cadeia de 3 Edge Functions sem timeout no frontend

O fluxo `admin-link-boleto` encadeia chamadas internas:

```text
Frontend (sem timeout)
  └─► admin-link-boleto (cold start ~2-10s)
        ├─► quitaplus-prepayment-status (cold start ~2-10s)
        └─► quitaplus-link-boleto (cold start ~2-10s + 3 retries com backoff)
```

Cada cold start pode levar 2-10 segundos. O `quitaplus-link-boleto` tem **3 tentativas com backoff exponencial** (1s, 2s, 3s entre tentativas). No pior caso, são **30+ segundos** de espera encadeada. O frontend não tem nenhum timeout — simplesmente aguarda indefinidamente.

### 2. O `admin-link-boleto` retorna HTTP 400 para validações, que o Supabase client trata como erro genérico

Quando o `admin-link-boleto` retorna status 400 (por exemplo, "Tipo de pagamento inválido" ou "Cartão não aprovado"), o `supabase.functions.invoke()` lança um erro genérico sem o body JSON detalhado. O frontend pode não conseguir ler a mensagem real de erro, ficando travado no loading sem feedback.

---

## Plano de Correção

### Arquivo: `src/pages/ChargeHistory.tsx` — função `handleAdminLinkBoleto`

**Mudança 1: Adicionar timeout de 20 segundos**

Envolver a chamada `supabase.functions.invoke('admin-link-boleto')` em um `Promise.race` com timeout de 20 segundos. Se estourar:
- Parar o loading (`setLinkingBoleto(false)`)
- Mostrar toast informando que a operação demorou demais e que o usuário deve tentar novamente

**Mudança 2: Melhorar tratamento de erro**

Ajustar a verificação de erro para ler corretamente tanto `error` do Supabase quanto `data.success === false` (padrão usado pela edge function para erros de negócio retornados com HTTP 200). Mostrar `data.message` quando disponível.

### Arquivo: `supabase/functions/admin-link-boleto/index.ts`

**Mudança 3: Retornar HTTP 200 para todas as respostas de validação**

As linhas que retornam `status: 400` e `status: 401`/`403` impedem o Supabase client JS de ler o body JSON. Alterar TODAS as respostas de erro de negócio para retornar HTTP 200 com `{ success: false, error: '...', message: '...' }`, seguindo o padrão já documentado na memória do projeto (`edge-function-error-reporting-standard`).

Respostas afetadas (5 blocos):
- Linha 33: "Token de autenticação ausente" → HTTP 200 + success: false
- Linha 38: "Token inválido" → HTTP 200 + success: false  
- Linha 51: "Acesso negado" → HTTP 200 + success: false
- Linha 73: "Linha digitável inválida" → HTTP 200 + success: false
- Linha 98/105: "Tipo inválido" / "Cartão não aprovado" → HTTP 200 + success: false

---

## O que NÃO muda

- Nenhum layout/UI alterado (cores, tamanhos, posições)
- Nenhum contrato de integração com Quita+ modificado
- Lógica de validação preservada (apenas códigos HTTP ajustados)
- Fluxo funcional preservado (validar → verificar status → vincular → atualizar DB)
- Edge functions `quitaplus-link-boleto` e `quitaplus-prepayment-status` inalteradas

## Resultado Esperado

- Botão "Vinculando..." nunca fica preso por mais de 20 segundos
- Mensagens de erro de validação exibidas corretamente ao admin
- Em caso de timeout, feedback claro ao usuário

