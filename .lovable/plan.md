

# Corrigir QR Code PIX quebrado (prefixo base64 duplicado)

## Problema

O AbacatePay retorna `brCodeBase64` com o prefixo completo `data:image/png;base64,...`, mas o frontend adiciona esse mesmo prefixo novamente ao montar o `src` da imagem, resultando em uma string invalida que o navegador nao consegue renderizar.

## Solucao

Corrigir o frontend para detectar se o base64 ja contem o prefixo `data:` e usalo diretamente, sem duplicar.

## Detalhes tecnicos

### Arquivo: `src/pages/CheckoutPix.tsx`

Alterar a linha do `<img>` (aproximadamente linha 236) de:

```tsx
src={`data:image/png;base64,${pixData.qr_code_base64}`}
```

Para:

```tsx
src={pixData.qr_code_base64.startsWith('data:') 
  ? pixData.qr_code_base64 
  : `data:image/png;base64,${pixData.qr_code_base64}`}
```

Isso garante compatibilidade tanto com o formato atual do AbacatePay (que inclui o prefixo) quanto com eventuais respostas futuras sem prefixo.

## O que NAO muda

- Nenhuma Edge Function e alterada
- Nenhum layout/design e modificado
- Nenhuma integracao e alterada
- Apenas 1 linha de codigo no frontend e ajustada

