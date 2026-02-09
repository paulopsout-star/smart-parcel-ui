

# Remover descricao de mes/ano dos StatCards

## O que muda

Remover o texto de descricao (description) que inclui mes e ano de cada um dos 6 StatCards na secao "Resumo". O titulo da secao "Resumo — Fevereiro De 2026" ja informa o periodo, tornando a repeticao desnecessaria nos cards individuais.

## Alteracao

**Arquivo:** `src/pages/Dashboard.tsx`

Remover a prop `description` dos 6 StatCards, ou substituir por descricoes curtas e genericas sem referencia ao mes:

| Card | Descricao atual | Nova descricao |
|---|---|---|
| Total de Cobrancas | "Cobrancas em fevereiro de 2026" | "Todas as cobrancas do periodo" |
| Cobrancas Ativas | "Pendentes ou processando em fevereiro de 2026" | "Pendentes ou processando" |
| Concluidas | "Pagas com sucesso em fevereiro de 2026" | "Pagas com sucesso" |
| Valor Total | "Valor total em fevereiro de 2026" | "Soma de todas as cobrancas" |
| Pagamentos Concluidos | "Valores pagos em fevereiro de 2026" | "Total de valores pagos" |
| Combinados Pendentes | "Combinados pendentes em fevereiro de 2026" | "PIX ou cartao pago, outro pendente" |

Tambem remover as variaveis `monthName` e `monthTitle` que nao serao mais usadas nas descricoes (manter `monthTitle` apenas para o titulo da secao "Resumo").

## O que NAO muda

- O titulo da secao "Resumo — Fevereiro De 2026" permanece (ja indica o periodo)
- Os filtros de data nas queries continuam funcionando (apenas mes atual)
- Layout, design e logica dos cards permanecem identicos
- Nenhum outro arquivo e alterado

