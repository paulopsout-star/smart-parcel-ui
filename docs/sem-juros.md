# Modalidade "sem juros" (Quita+)

Parcelamento sem juros financiado pelo desconto do credor. Tabela: ≥20% → 3x · ≥25% → 6x · ≥27% → 9x · ≥30% → 12x
(acima de 30% a operação retém no máximo 35% da dívida; o excedente volta ao cliente). Parcela mínima R$ 20,00. Sem taxa de PIX.

**Fato comprovado em 07/11/2026:** a tabela sem juros na autorização do Quita+ só vale com a combinação
credencial nova + `MerchantId` + `CreditorDocument` = CNPJ sem juros (54329414000502). Qualquer outra combinação cobra com juros.

## Isolamento (nada do fluxo atual muda)

| Camada | O que é novo | Como desliga |
|---|---|---|
| Banco | `app_settings.sem_juros_ativo` (interruptor), `profiles.sem_juros_habilitado` (só admin altera), `charges.modalidade`, `sem_juros_regras()`, gatilho `charges_definir_modalidade` | `update app_settings set value='false' where key='sem_juros_ativo'`; reversão total em `docs/rollback/` |
| Edge functions | `_shared/quitaplus-sj.ts`, `quitaplus-sj-simulation`, `quitaplus-sj-prepayment`, `quitaplus-sj-link-boleto`, `quitaplus-sj-status`, `quitaplus-sj-boleto-inter`, `public-charge-modalidade` | ficam ociosas: só são chamadas para cobrança com `modalidade = 'sem_juros'` |
| Front | `src/features/sem-juros/` + pontos de inserção condicionados a `semJurosHabilitado` (AuthContext) e à modalidade da cobrança | interruptor desligado devolve as telas como hoje |

As funções atuais (`quitaplus-token`, `quitaplus-prepayment`, `quitaplus-link-boleto`, `quitaplus-prepayment-status`,
`quitaplus-simulation`, `inter-boleto-issue`, `admin-link-boleto`) **não foram alteradas**.

## Fluxo

1. Admin liga o interruptor (app_settings) e o parâmetro do usuário (Usuários → "Sem juros").
2. Usuário habilitado clica em Nova Cobrança → o simulador abre. "Continuar" (≥20%) preenche a cobrança sem juros;
   "Continuar com juros" (<20%) preenche a cobrança no fluxo atual com o carimbo `metadata.simulacao`.
   Cobrança com cartão sem simulação é recusada pelo gatilho do banco.
3. O gatilho recalcula a regra, valida valores/parcelas/split, zera a taxa de PIX e grava `modalidade = 'sem_juros'`.
4. Checkout: `public-charge-modalidade` diz a modalidade; sem juros usa `quitaplus-sj-simulation` (parcelas da faixa,
   acréscimo zero obrigatório) e `quitaplus-sj-prepayment` (credencial/lojista/credor fixos, trava de acréscimo zero,
   tentativa única). PIX sem taxa.
5. Boleto do Quita+: **sempre o do Inter com o valor do cartão** (`quitaplus-sj-boleto-inter`, automático com
   `INTER_AUTO_ISSUE=true` ou pelo botão do histórico). O boleto do credor (valor à vista) nunca é vinculado:
   o cartão vale mais que ele (inclui o desconto retido).
6. Histórico: selo "Sem juros"; admin vê dívida, boleto do credor, desconto retido (R$ e %), repasse ao cliente.

## Secrets

`QUITAPLUS_SEMJUROS_CLIENT_ID`, `QUITAPLUS_SEMJUROS_CLIENT_SECRET` (obrigatórios), `QUITAPLUS_SEMJUROS_MERCHANT_ID`
(opcional, padrão 54329414000502), `QUITAPLUS_SEMJUROS_CREDITOR_NAME` (razão social do CNPJ sem juros; opcional).

## Ordem de implantação

1. Migração `20261107180000_sem_juros_modalidade.sql` (inerte: interruptor desligado). **Antes do front**: o histórico
   seleciona `charges.modalidade`.
2. Deploy das 7 funções novas.
3. Front (Vercel).
4. Piloto: ligar interruptor + parâmetro de 1 usuário; cobrança real de R$ 20,00 ponta a ponta.

Testes SQL: `docs/tests/README.md`. Reversão: `docs/rollback/20261107180000_sem_juros_modalidade.down.sql`.
