

# Adicionar colunas "Valor Original PIX" e "Valor Original Cartao" no relatorio exportado

## O que muda

Na funcao `generateExportData` do `ChargeHistory.tsx`, serao adicionadas 2 novas colunas no relatorio CSV/Excel:

- **Valor Original PIX (R$)** -- o `amount_cents` do split PIX (valor base sem taxa)
- **Valor Original Cartao (R$)** -- o `amount_cents` do split de cartao (valor base sem juros)

## Detalhes tecnicos

**Arquivo:** `src/pages/ChargeHistory.tsx`

**Alteracao na funcao `generateExportData` (linhas 1422-1443):**

1. Adicionar 2 headers apos "Valor (R$)":
   - `'Valor Original PIX (R$)'`
   - `'Valor Original Cartão (R$)'`

2. Para cada charge, extrair os splits:
   - `pixSplit = charge.splits?.find(s => s.method === 'pix')`
   - `cardSplit = charge.splits?.find(s => s.method === 'credit_card')`

3. Gerar os valores formatados:
   - PIX: `pixSplit ? (pixSplit.amount_cents / 100).toFixed(2).replace('.', ',') : '-'`
   - Cartao: `cardSplit ? (cardSplit.amount_cents / 100).toFixed(2).replace('.', ',') : '-'`

4. Inserir as 2 colunas na posicao correta no array de cada row (apos o campo "Valor").

## O que NAO muda

- Nenhuma tela/UI e alterada (apenas o conteudo do arquivo exportado)
- As demais colunas permanecem identicas
- A logica de filtros e a funcao de download nao sao alteradas
- Os dados dos splits ja estao carregados no componente (via query existente)

