

# Plano: Gerar PDF de Regras e Diretrizes da Plataforma Autonegocie

## Objetivo
Criar um documento PDF profissional e completo contendo todas as regras de negocio, fluxos, diretrizes de mudancas e politicas da plataforma Hub de Pagamentos Autonegocie.

## Conteudo do Documento

O PDF sera estruturado nas seguintes secoes:

1. **Capa** - Titulo, versao, data
2. **Principios Imutaveis** - Regras que nunca podem ser violadas
3. **Politica de Mudancas** - Protocolo de aprovacao para integracoes e telas
4. **Autenticacao e RBAC** - Roles, guards, permissoes por funcionalidade
5. **Assinaturas** - Status canonico, gate de acesso, regras de bloqueio
6. **Cobranças** - Pontuais, recorrentes, validacoes, campos obrigatorios
7. **Checkout Publico** - Opcoes de pagamento, regras de parcelas, centavos
8. **Split de Pagamento** - PIX + Cartao, soma exata, parcela minima
9. **Integracao Quita+** - Contrato canonico, proxy, sanitizacao
10. **Fluxos Principais** - Diagramas de Nova Cobranca, Historico, Checkout
11. **Regras de Exibicao de Valores** - display_amount_cents vs amount_cents
12. **Regras de Dominio/Links** - Dominio oficial obrigatorio
13. **Tabelas do Banco de Dados** - Schema resumido
14. **Edge Functions** - Inventario e proposito
15. **Erros Comuns e Tratamento**
16. **Criterios de Aceite Globais**

## Implementacao

- Script Python com `reportlab` para gerar o PDF
- Cores da marca Autonegocie (verde #00D678, azul escuro #1E3A5F)
- Output em `/mnt/documents/Regras_Diretrizes_Autonegocie.pdf`
- QA visual obrigatorio apos geracao

## Correcao do Build Error

Tambem sera necessario corrigir o erro de build em `treeal-auth.ts` que usa `npm:node-forge@1.3.1` — precisa ser adicionado ao `deno.json` ou ajustar o import.

### Nota sobre o build error
O erro `Could not find a matching package for 'npm:node-forge@1.3.1'` em `treeal-auth.ts` e um problema de dependencia Deno. Sera corrigido junto com a entrega.

