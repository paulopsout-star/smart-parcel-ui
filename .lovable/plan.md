

# Plano: Destravar criação de cobrança — gerar link em background

## Diagnóstico

A criação de cobrança trava porque o fluxo é **síncrono e bloqueante**:

1. INSERT da cobrança no DB (sem timeout — se a rede/Supabase demorar, trava PARA SEMPRE)
2. Aguarda `charge-links` edge function (com timeout de 15s, mas o cold start pode ser > 15s)

O botão fica em "Criando cobrança..." porque: (a) o INSERT pode demorar, e (b) mesmo que o INSERT complete, o React pode não re-renderizar a label para "Gerando link..." antes de travar no `await` da edge function.

**O problema real**: a geração do link **bloqueia** a confirmação da cobrança. O usuário fica preso esperando algo que deveria ser feito em segundo plano.

## Solução: fire-and-forget para o link

Separar o fluxo em duas etapas independentes:

1. **INSERT da cobrança** → assim que o INSERT retornar com sucesso, **mostrar sucesso imediatamente** (toast + modal ou redirect)
2. **Gerar link em background** → chamar `charge-links` sem `await`, sem bloquear o usuário. O link aparecerá no histórico quando estiver pronto.

Isso elimina o travamento porque o usuário nunca espera pelo link.

## Mudanças em `src/pages/NewCharge.tsx`

### Refatorar o bloco pós-INSERT (linhas ~397-456)

Substituir o `await Promise.race([linkPromise, timeoutPromise])` por um fire-and-forget:

```ts
// Após INSERT bem-sucedido:
// 1. Disparar geração de link em background (não bloqueia)
supabase.functions.invoke('charge-links', {
  body: { chargeId: charge.id, action: 'create' }
}).then(({ data: linkData }) => {
  if (linkData?.link?.url) {
    console.log('[NewCharge] Link gerado em background:', linkData.link.url);
  }
}).catch(err => {
  console.warn('[NewCharge] Link será gerado depois:', err.message);
});

// 2. Mostrar sucesso imediato com dados já disponíveis
const PRODUCTION_DOMAIN = 'https://pay1.autonegocie.com';
toast({ title: "Cobrança criada!", description: "Link de checkout sendo gerado..." });
setCheckoutData({
  chargeId: charge.id,
  checkoutUrl: `${PRODUCTION_DOMAIN}/checkout/${charge.id}`,
  linkId: charge.id,
  amount: charge.amount,
  payerName: charge.payer_name,
  description: charge.description || undefined,
  status: 'PENDENTE'
});
setShowCheckoutModal(true);
```

### Adicionar AbortController ao INSERT (proteção contra hang de rede)

Envolver o `supabase.from('charges').insert(...)` com um AbortController de 10s para que, mesmo em caso de problema de rede, o usuário receba feedback em vez de ficar travado.

## O que NÃO muda

- Nenhum layout, cor ou componente visual
- Nenhuma edge function ou integração
- Lógica de PIX e boleto (já funcionam com retorno imediato)
- O link continua sendo gerado — apenas **não bloqueia** mais o usuário

