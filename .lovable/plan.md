
# Filtrar Dashboard para exibir apenas dados do mes atual

## Problema atual

A pagina Dashboard (`src/pages/Dashboard.tsx`) busca **todas** as cobrancas e splits do banco de dados sem nenhum filtro de data. Isso faz com que os cards de resumo mostrem totais acumulados de todos os tempos em vez de apenas o mes corrente.

## Solucao

Alterar a funcao `loadDashboardStats` em `src/pages/Dashboard.tsx` para filtrar os dados pelo mes atual.

### Alteracoes no arquivo `src/pages/Dashboard.tsx`

**1. Calcular inicio e fim do mes atual**

No inicio da funcao `loadDashboardStats`, criar as datas de referencia:

```text
const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
```

**2. Adicionar filtro de data na query de charges**

A query atual:
```text
supabase.from('charges').select('*')
```

Passa a ser:
```text
supabase.from('charges').select('*')
  .gte('created_at', startOfMonth)
  .lte('created_at', endOfMonth)
```

**3. Adicionar filtro de data na query de payment_splits**

A query atual:
```text
supabase.from('payment_splits')
  .select('charge_id, method, status, amount_cents')
  .not('charge_id', 'is', null)
```

Passa a ser:
```text
supabase.from('payment_splits')
  .select('charge_id, method, status, amount_cents')
  .not('charge_id', 'is', null)
  .gte('created_at', startOfMonth)
  .lte('created_at', endOfMonth)
```

**4. Atualizar descricoes dos cards para refletir o periodo**

Adicionar uma variavel com o nome do mes atual para exibir nas descricoes:

```text
const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
// Exemplo: "fevereiro de 2026"
```

Atualizar as descricoes dos StatCards:

| Card | Descricao atual | Nova descricao |
|---|---|---|
| Total de Cobrancas | "Todas as cobrancas" | "Cobrancas em {mes}" |
| Cobrancas Ativas | "Pendentes ou processando" | "Pendentes ou processando em {mes}" |
| Concluidas | "Pagas com sucesso" | "Pagas com sucesso em {mes}" |
| Valor Total | "Soma de todas as cobrancas" | "Valor total em {mes}" |
| Pagamentos Concluidos | "Total de valores pagos com sucesso" | "Valores pagos em {mes}" |
| Combinados Pendentes | "PIX ou cartao pago, outro pendente" | "Combinados pendentes em {mes}" |

**5. Atualizar titulo da secao Resumo**

O titulo "Resumo" passa a incluir o mes:

```text
Resumo - Fevereiro 2026
```

### O que NAO muda

- Nenhum outro arquivo (edge functions, componentes, etc.)
- A logica de calculo das estatisticas permanece identica
- O layout e design dos cards nao muda
- As Acoes Rapidas nao sao afetadas
- O StatCard component nao e alterado

### Resultado esperado

- Os 6 cards de resumo exibem dados exclusivamente do mes corrente
- As descricoes indicam claramente o periodo exibido
- O titulo da secao confirma o mes de referencia
- A cada virada de mes, os dados se resetam automaticamente
