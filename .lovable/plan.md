

# Correcao Manual de 13 Registros Historicos com Status Incorreto

## Diagnostico

Foram identificados **13 charges** do tipo `cartao_pix` cujo status atual nao reflete o estado real dos seus splits. Todos sao resultado do bug anterior onde `sync-payment-status` sobrescrevia o status sem considerar os splits.

## Registros a Corrigir

### Grupo 1: Ambos splits `concluded` -- charge deve ser `completed` (1 registro)

| ID | Cliente | Status Atual | PIX | Cartao | Correcao |
|---|---|---|---|---|---|
| `0a47656b` | Iago Augusto Campos Rodrigues | `cancelled` | concluded | concluded | `completed` |

Este e o caso mais grave: pagamento **totalmente concluido** mas marcado como cancelado.

### Grupo 2: PIX `concluded` + Cartao intermediario -- charge deve ser `processing` (12 registros)

| ID | Cliente | Status Atual | PIX | Cartao | Correcao |
|---|---|---|---|---|---|
| `8f36fc38` | LUCIANO ASSUNCAO DA SILVA | `pending` | concluded | pending | `processing` |
| `f4aac4a6` | Thais Lopes Cunha | `pending` | concluded | pending | `processing` |
| `569abbe6` | Paulo Pereira Souto | `pending` | concluded | pending | `processing` |
| `526a9f56` | Paulo Pereira Souto | `pending` | concluded | pending | `processing` |
| `d442b2f3` | BEATRIZ PEREIRA DE SOUSA | `cancelled` | concluded | analyzing | `processing` |
| `ff27c6d4` | Paulo Pereira Souto | `cancelled` | concluded | analyzing | `processing` |
| `c97f60c5` | Paulo Pereira Souto | `cancelled` | concluded | analyzing | `processing` |
| `cda831b6` | Paulo Pereira Souto | `cancelled` | concluded | analyzing | `processing` |
| `7df32f8d` | Paulo Pereira Souto | `cancelled` | concluded | analyzing | `processing` |
| `18339005` | Paulo Pereira Souto | `cancelled` | concluded | analyzing | `processing` |
| `aad2b927` | Paulo Pereira Souto | `cancelled` | concluded | analyzing | `processing` |
| `d67eb497` | Anderlan Lahuri Dias Aires Karaja Silva | `cancelled` | concluded | boleto_linked | `processing` |

## Detalhes Tecnicos

### Operacao 1: Corrigir Iago Augusto (cancelled para completed)

Atualizar o charge para `completed` e preencher `completed_at` com a data do ultimo split concluido (2026-01-08 01:05:34).

```sql
UPDATE charges
SET status = 'completed',
    completed_at = '2026-01-08T01:05:34.394+00',
    updated_at = now()
WHERE id = '0a47656b-1764-44d0-bda8-678822ab18ea';
```

### Operacao 2: Corrigir 12 charges para processing

```sql
UPDATE charges
SET status = 'processing',
    updated_at = now()
WHERE id IN (
  '8f36fc38-4dc8-428c-a5fa-2c18fb9ff831',
  'f4aac4a6-3be2-4ab5-8397-781e7d1693f2',
  '569abbe6-0b14-4f48-8489-f645c81768d9',
  '526a9f56-0dc2-475e-a355-ff7b828eedc7',
  'd442b2f3-0d74-41db-885a-74d786e12de9',
  'ff27c6d4-5b53-4045-ad66-0145138ff73f',
  'c97f60c5-fed4-490e-9f84-3945a9b6ce4d',
  'cda831b6-acde-4f4e-9e93-10b899ecbb8a',
  '7df32f8d-0a51-431b-9801-77ad0013f715',
  '18339005-7197-4f40-af28-3c4e84df4e89',
  'aad2b927-6bae-4f16-80e9-cc307b13f154',
  'd67eb497-03ac-412f-a1bb-54d7f1e323cc'
);
```

### Operacao 3: Validacao pos-correcao

Reexecutar a query de verificacao para confirmar que nenhum charge `cartao_pix` tem status divergente dos seus splits.

### O que NAO muda

- Nenhum arquivo de codigo (frontend ou edge functions)
- Nenhum schema de banco de dados
- Os splits permanecem inalterados (ja estao corretos)
- Apenas o campo `status` (e `completed_at` no caso do Iago) das charges e atualizado

### Resultado esperado

- Iago Augusto aparecera como **Concluido** (verde) no historico, refletindo que ambos PIX e Cartao foram pagos
- Os 12 charges com PIX pago aparecerao como **Em Processamento** (amarelo), indicando corretamente que falta a conclusao do cartao
- Nenhum charge `cartao_pix` tera mais discrepancia entre seu status e o estado real dos splits
- O sync-payment-status corrigido anteriormente impedira que este problema se repita

