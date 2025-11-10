# Script SQL: Atualizar Dados do Credor em Cobranças Antigas

## ⚠️ IMPORTANTE: Execute este script APENAS APÓS obter os valores corretos dos secrets

Este script preenche os campos `creditor_document` e `creditor_name` nas cobranças que possuem `boleto_linha_digitavel` mas ainda não têm esses campos preenchidos.

---

## 📋 Passo 1: Obter os valores dos secrets

Antes de executar o script, você precisa obter os valores dos seguintes secrets no Supabase:

1. **QUITA_MAIS_CREDITOR_DOCUMENT** (ex: `54.329.414/0001-98`)
2. **QUITA_MAIS_CREDITOR_NAME** (ex: `AUTONEGOCIE`)

**Como obter:**
- Acesse: Supabase Dashboard → Settings → Edge Functions → Secrets
- Copie os valores de `QUITA_MAIS_CREDITOR_DOCUMENT` e `QUITA_MAIS_CREDITOR_NAME`

---

## 📝 Passo 2: Script SQL

Execute o script abaixo substituindo `<CREDITOR_DOCUMENT>` e `<CREDITOR_NAME>` pelos valores reais:

```sql
-- ============================================
-- SCRIPT: Atualizar creditor_document e creditor_name
-- Descrição: Preenche dados do credor em cobranças antigas com boleto
-- Data: 2025-11-10
-- ============================================

-- 1. Verificar quantas cobranças serão atualizadas (DRY RUN)
SELECT 
  id,
  payer_name,
  amount,
  boleto_linha_digitavel,
  creditor_document,
  creditor_name,
  created_at
FROM charges
WHERE 
  has_boleto_link = true
  AND boleto_linha_digitavel IS NOT NULL
  AND (creditor_document IS NULL OR creditor_name IS NULL)
ORDER BY created_at DESC;

-- 2. Atualizar cobranças (EXECUTE APENAS UMA VEZ)
UPDATE charges
SET 
  creditor_document = '54329414001414',        -- ✅ Novo valor correto
  creditor_name = 'Auto Negocie Digital Full', -- ✅ Novo valor correto
  updated_at = now()
WHERE 
  has_boleto_link = true
  AND boleto_linha_digitavel IS NOT NULL
  AND (creditor_document IS NULL OR creditor_name IS NULL);

-- 3. Validar atualização (verificar se todos foram preenchidos)
SELECT 
  COUNT(*) AS total_cobranças_com_boleto_link,
  COUNT(CASE WHEN creditor_document IS NOT NULL THEN 1 END) AS com_creditor_document,
  COUNT(CASE WHEN creditor_name IS NOT NULL THEN 1 END) AS com_creditor_name,
  COUNT(CASE WHEN creditor_document IS NULL OR creditor_name IS NULL THEN 1 END) AS faltando_dados
FROM charges
WHERE has_boleto_link = true;
```

---

## ✅ Critérios de Aceite

Após executar o script, verifique:

- [ ] Query 1 (DRY RUN) retornou as cobranças que serão atualizadas
- [ ] Query 2 (UPDATE) foi executada **com os valores reais** (sem `<...>`)
- [ ] Query 3 (VALIDAÇÃO) mostra `faltando_dados = 0`
- [ ] Cobranças antigas agora têm `creditor_document` e `creditor_name` preenchidos
- [ ] Novas cobranças criadas após as correções **já vêm preenchidas automaticamente**

---

## 🔄 Rollback (se necessário)

Se precisar reverter a atualização (NÃO RECOMENDADO, mas disponível para emergências):

```sql
-- ⚠️ USE COM CAUTELA: Remove os dados do credor adicionados pelo script
UPDATE charges
SET 
  creditor_document = NULL,
  creditor_name = NULL,
  updated_at = now()
WHERE 
  has_boleto_link = true
  AND boleto_linha_digitavel IS NOT NULL
  AND updated_at > '<DATA_DA_EXECUCAO_DO_SCRIPT>'; -- Substitua pela data/hora exata
```

---

## 📊 Monitoramento pós-correção

Para garantir que o fluxo está funcionando, monitore os logs após criar novas cobranças:

1. **Console do navegador** (NewCharge):
   ```
   [NewCharge] ✅ Creditor settings loaded: {document: '***1-98', name: 'AUTONEGOCIE'}
   ```

2. **Console do navegador** (PaymentForm):
   ```
   [PaymentForm] 🔍 Verificando condições para vincular boleto: {
     hasBoleto: true,
     temLinhaDigitavel: true,
     comprimentoLinha: 47,
     temCreditorDocument: true,
     creditorDocument: '***1-98',
     temCreditorName: true,
     creditorName: 'AUTONEGOCIE'
   }
   ```

3. **Edge Function Logs** (quitaplus-link-boleto):
   ```
   Vinculando boleto à autorização...
   Boleto vinculado com sucesso!
   ```

---

## 🎯 Resumo das Correções Implementadas

| Item | Status | Descrição |
|------|--------|-----------|
| **Validação de carregamento** | ✅ | NewCharge bloqueia criação se `creditorSettings` for NULL |
| **Alerta visual** | ✅ | Alert vermelho aparece se configurações não forem carregadas |
| **Logs de debug** | ✅ | PaymentForm registra todos os campos antes de vincular boleto |
| **Migração de dados** | ⏳ | Aguardando execução do script SQL com valores reais |
| **Prevenção de erros futuros** | ✅ | Novas cobranças sempre terão dados do credor preenchidos |

---

## 📞 Suporte

Se encontrar problemas:
1. Verificar logs do navegador (Console)
2. Verificar logs do Edge Function `quitaplus-link-boleto`
3. Confirmar que os secrets estão configurados corretamente no Supabase
4. Validar que o banco de dados tem os dados atualizados (Query 3)
