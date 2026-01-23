

## Plano: Adicionar Link de Checkout no Sheet de Detalhes

### Problema Identificado

O Sheet de "Detalhes da Cobranca" (aberto pelo botao "Detalhes") nao possui as opcoes de:
- Copiar link de checkout
- Gerar novo link de checkout
- Abrir link de checkout

Essas funcionalidades existem no componente `CheckoutButtons` (linhas 1208-1309) mas nao estao sendo usadas no Sheet.

---

### Solucao Proposta

Adicionar uma secao "Link de Pagamento" no Sheet de detalhes, reutilizando o componente `CheckoutButtons` ja existente.

---

### Alteracoes Necessarias

**Arquivo:** `src/pages/ChargeHistory.tsx`

**Local:** Dentro do Sheet de detalhes, apos os InfoCards (linha 1705) e antes da secao "Empresa da Cobranca" (linha 1707)

**Codigo a adicionar:**

```tsx
{/* Link de Pagamento */}
<div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
  <h4 className="font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
    <Link2 className="h-4 w-4" />
    Link de Pagamento
  </h4>
  <CheckoutButtons charge={selectedCharge} />
</div>
```

---

### Diagrama Visual

```text
┌─────────────────────────────────────────────────┐
│          SHEET: Detalhes da Cobranca            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────┐  ┌─────────────┐               │
│  │  PAGADOR    │  │   EMAIL     │               │
│  │ Gildete ... │  │ gonsalv...  │               │
│  └─────────────┘  └─────────────┘               │
│                                                 │
│  ┌─────────────┐  ┌─────────────┐               │
│  │  TELEFONE   │  │  CPF/CNPJ   │               │
│  │ (84) 981... │  │ 125.123...  │               │
│  └─────────────┘  └─────────────┘               │
│                                                 │
│  ┌─────────────┐                                │
│  │   VALOR     │                                │
│  │ R$ 1.238,74 │                                │
│  └─────────────┘                                │
│                                                 │
│  ┌─────────────────────────────────────────────┐│
│  │ NOVO: Link de Pagamento (azul)              ││
│  │                                             ││
│  │  [Abrir Link]  [Copiar]                     ││
│  │                                             ││
│  │  ou                                         ││
│  │                                             ││
│  │  [Tentar Novamente]  [Gerar Novo Link]      ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  ┌─────────────────────────────────────────────┐│
│  │ Empresa da Cobranca (roxo)                  ││
│  │ PASCHOALOTTO...           [Alterar]         ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Status: Pendente | pontual | Cartao           │
│                                                 │
│  Linha Digitavel: ...                          │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### Detalhes Tecnicos

| Aspecto | Descricao |
|---------|-----------|
| Componente reutilizado | `CheckoutButtons` (ja existente, linha 1208) |
| Hook utilizado | `useChargeLinks()` (ja importado, linha 14) |
| Icone | `Link2` (ja importado, linha 13) |
| Estilo | Caixa azul igual ao padrao do design system |
| Posicao | Apos InfoCards, antes de "Empresa da Cobranca" |

---

### Comportamento do Componente `CheckoutButtons`

O componente ja implementa toda a logica necessaria:

| Estado | Comportamento |
|--------|---------------|
| Carregando | Exibe spinner "Carregando..." |
| Link nao existe | Exibe botoes "Tentar Novamente" e "Gerar Novo Link" |
| Link existe | Exibe botoes "Abrir Link" e "Copiar" |
| Cobranca concluida | Botoes de geracao desabilitados + mensagem "Pagamento ja concluido" |

---

### Arquivos Alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/ChargeHistory.tsx` | Adicionar secao "Link de Pagamento" no Sheet de detalhes |

---

### Criterios de Aceite

1. Secao "Link de Pagamento" visivel no Sheet de detalhes
2. Botao "Copiar" funciona corretamente (copia URL para clipboard)
3. Botao "Abrir Link" abre o checkout em nova aba
4. Botao "Gerar Novo Link" cria novo link e exibe modal de sucesso
5. Estados de loading/erro funcionam normalmente
6. Estilo consistente com outras secoes (caixa azul com borda)
7. Nenhuma funcionalidade existente removida

