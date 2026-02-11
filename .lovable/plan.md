

# Atualizar chave de integracao AbacatePay

## O que sera feito

Atualizar o valor do secret `ABACATEPAY_API_KEY` no Supabase com a nova chave fornecida por voce.

## Detalhes tecnicos

- **Secret a atualizar:** `ABACATEPAY_API_KEY`
- **Metodo:** Usar a ferramenta de secrets do Lovable para solicitar o novo valor
- **Impacto:** Todas as 4 Edge Functions que usam essa chave (`mercadopago-pix-create`, `mercadopago-pix-status`, `sync-mercadopago-status`, `mercadopago-webhook`) passarao a usar a nova chave automaticamente
- **Downtime:** Nenhum. A troca e instantanea

## O que NAO muda

- Nenhum codigo e alterado
- Nenhuma Edge Function precisa ser reimplantada
- Nenhuma tela/UI e modificada

## Apos a atualizacao

- Recomendado testar a criacao de um PIX para validar que a nova chave esta funcionando

