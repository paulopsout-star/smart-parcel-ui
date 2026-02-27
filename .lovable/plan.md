

# Plano: Otimizar carregamento de links de pagamento no histórico

## Problema

O componente `CheckoutButtons` chama `getExistingLink(charge.id)` para **cada cobrança** na lista. Isso dispara uma query individual ao DB (e potencialmente uma chamada à edge function `charge-links`) **por cobrança**. Com 100 cobranças, são 100+ requests paralelos, causando lentidão.

**Dado que a query principal de cobranças já retorna `checkout_url` e `checkout_link_id`**, essas chamadas individuais são desnecessárias.

## Mudança

### `src/pages/ChargeHistory.tsx` — Componente `CheckoutButtons`

Refatorar para usar diretamente os campos `charge.checkout_url` e `charge.checkout_link_id` já presentes no objeto `charge`, **eliminando** a chamada a `getExistingLink()`.

Lógica:
- Se `charge.checkout_url` existe → exibir botões de copiar/abrir imediatamente (sem loading, sem fetch)
- Se não existe → exibir "Link indisponível" + botão "Gerar Novo Link"
- Manter `generateLink` para geração manual (já funciona via mutation)
- Remover `getExistingLink` do componente (e a dependência de `useChargeLinks` para queries automáticas)

Resultado: **zero queries adicionais** no carregamento da lista. Links aparecem instantaneamente.

