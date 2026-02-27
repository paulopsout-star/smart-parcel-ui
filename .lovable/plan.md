

# Diagnóstico: Por que a criação de cobrança trava

## Investigação realizada

1. **Banco de dados**: A cobrança mais recente (aa7af067) foi criada com sucesso às 15:52, COM checkout_url preenchido. O INSERT funciona.
2. **Edge Function charge-links**: Está deployada (retorna 401 sem token, comportamento esperado). Sem logs recentes — pode ter cold starts longos.
3. **Tabelas**: 437 cobranças, 371 payment_links — volume baixo. Índices existem em company_id e user_id. RLS não deveria ser lento.
4. **Triggers**: Nenhum trigger na tabela charges.

## Causa raiz identificada

Encontrei um bug estrutural no fluxo de submissão:

```text
Linha 272: setIsLoading(true)   ← FORA do try
Linha 273: setLoadingStage('creating')
Linha 274: setError("")
Linha 276: try {
  ...
Linha 447: } finally {
Linha 448:   setIsLoading(false)  ← só roda se entrou no try
}
```

**`setIsLoading(true)` está FORA do `try` block (linha 272), mas `setIsLoading(false)` está DENTRO do `finally` (linha 448).** Se qualquer erro síncrono ocorrer entre as linhas 272-276, o `finally` nunca executa e o botão fica travado em "Criando cobrança..." permanentemente.

Além disso, a chamada `supabase.from('charges').insert(...).select().single()` na linha 304 pode ficar pendente indefinidamente caso haja instabilidade de rede — o `fetch` interno do Supabase JS não tem timeout nativo, e não há proteção contra isso.

## Mudanças em `src/pages/NewCharge.tsx`

### 1. Mover `setIsLoading(true)` para dentro do `try`

Garante que `finally` SEMPRE execute quando `isLoading` é true.

### 2. Envolver o INSERT com AbortController (10s)

Não é um "timeout cosmético" — é proteção contra hang de rede. Se o `fetch` interno do Supabase não resolver em 10s, o AbortController cancela a requisição e o catch mostra o erro. Sem isso, o `await` pode ficar pendente indefinidamente.

### 3. Validar `formatAmount` antes do INSERT

Se `data.amount` produzir NaN, rejeitar antes de enviar ao banco.

## O que NÃO muda

- Nenhum layout, cor ou componente
- Nenhuma edge function
- Lógica de fire-and-forget para link (já aplicada)
- Fluxo de PIX e boleto

