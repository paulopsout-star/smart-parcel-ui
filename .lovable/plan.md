

# Corrigir QR Code PIX quebrado em PaymentPix.tsx

## Problema

A mesma correção aplicada em `CheckoutPix.tsx` precisa ser aplicada em `src/pages/PaymentPix.tsx` (linha 415), que ainda usa o formato antigo sem verificar o prefixo `data:`.

## O que sera feito

Alterar a linha 415 de `PaymentPix.tsx` de:

```tsx
src={`data:image/png;base64,${pixData.qr_code_base64}`}
```

Para:

```tsx
src={pixData.qr_code_base64.startsWith('data:') 
  ? pixData.qr_code_base64 
  : `data:image/png;base64,${pixData.qr_code_base64}`}
```

## Detalhes tecnicos

- **Arquivo:** `src/pages/PaymentPix.tsx`, linha 415
- **Causa:** O AbacatePay retorna `brCodeBase64` já com o prefixo `data:image/png;base64,`, mas o frontend adiciona novamente, gerando uma string inválida
- **Correção identica** a que já foi aplicada em `CheckoutPix.tsx`

## O que NAO muda

- Nenhuma Edge Function alterada
- Nenhum layout/design modificado
- Apenas 1 linha de codigo ajustada

