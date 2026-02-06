

# Correcao: Regra do Botao "Vincular Boleto Manualmente"

## Problema

O botao "Vincular Boleto Manualmente" so aparece quando a charge possui `pre_payment_key`, mas a regra correta e: **o botao deve aparecer quando o split de cartao esta com status "Received" (statusCode 1 da API Quita+)**, que internamente e mapeado como `analyzing`.

## Dados do Banco (confirmacao)

Existem 6 cobranças combinadas com splits de cartao no status `analyzing` que deveriam exibir o botao:
- LEONARDO PEREIRA BARBOZA
- Manoel De Santana Gomes
- Paulo Pereira Souto
- SANDRA REGINA SILVA BEZERRA
- Dewson Oliveira Candial
- ANA CRISTINA DE PAIVA LIMA

Nenhuma delas exibe o botao atualmente porque a condicao verifica apenas `pre_payment_key` na charge, sem checar o status real do split.

## Correcao Proposta

### Arquivo: `src/pages/ChargeHistory.tsx` (Linhas 1993-1996)

**De:**
```typescript
{isAdmin && 
 selectedCharge.payment_method === 'cartao_pix' &&
 selectedCharge.pre_payment_key &&
 !selectedCharge.boleto_admin_linha_digitavel && (
```

**Para:**
```typescript
{isAdmin && 
 selectedCharge.payment_method === 'cartao_pix' &&
 selectedCharge.pre_payment_key &&
 !selectedCharge.boleto_admin_linha_digitavel &&
 selectedCharge.splits?.some(s => s.method === 'credit_card' && s.status === 'analyzing') && (
```

## Logica da Nova Regra

A condicao agora verifica 4 criterios:
1. Usuario e admin
2. Metodo de pagamento e `cartao_pix` (combinado)
3. Existe `pre_payment_key` (cartao foi pre-autorizado)
4. Boleto admin ainda nao foi vinculado
5. **NOVA:** Existe um split de cartao com status `analyzing` (Received na API Quita+)

Isso garante que o botao so aparece quando a pre-autorizacao foi recebida pela Quita+ e esta aguardando a vinculacao do boleto. Cobranças com status `boleto_linked`, `concluded`, `cancelled` ou `failed` nao exibem o botao.

## Resultado Esperado

- As 6 cobranças listadas acima passarao a exibir o campo de "Vincular Boleto Manualmente" nos detalhes.
- Cobranças ja vinculadas (`boleto_linked`) ou canceladas continuam sem o botao.

