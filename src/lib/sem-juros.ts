/**
 * Parcelamento sem juros financiado pelo desconto do credor.
 *
 * Regra de negócio (out/2026):
 *  - O credor concede um desconto d = (dívida − valor à vista) / dívida.
 *  - A tabela de referência diz até quantas parcelas sem juros esse desconto financia.
 *  - Até 30% de desconto, o cliente paga o valor integral da dívida, parcelado sem juros.
 *  - Acima de 30%, a operação retém no máximo 35% de desconto (30% financiam as 12x e
 *    5% são margem extra). O desconto que passar disso é repassado ao cliente, reduzindo
 *    o total parcelado.
 *  - Abaixo de 20% não há opção sem juros: cai no fluxo atual, com juros do Quita+.
 *  - Pagamento combinado: o operador informa o PIX; o restante do total do cliente vai
 *    para o cartão. Não há taxa de PIX neste fluxo.
 *  - Parcela mínima de R$ 20,00.
 *
 * Tudo em centavos inteiros; percentuais como fração (0,30 = 30%).
 */

export interface FaixaSemJuros {
  /** Desconto mínimo do credor (fração) para liberar a faixa. */
  descontoMinimo: number;
  parcelasMaximas: number;
}

/** Tabela de referência: "desconto do credor a partir de" → parcelas sem juros. Ordem decrescente. */
export const TABELA_SEM_JUROS: readonly FaixaSemJuros[] = [
  { descontoMinimo: 0.30, parcelasMaximas: 12 },
  { descontoMinimo: 0.27, parcelasMaximas: 9 },
  { descontoMinimo: 0.25, parcelasMaximas: 6 },
  { descontoMinimo: 0.20, parcelasMaximas: 3 },
];

/** Desconto mínimo que habilita o fluxo sem juros. */
export const DESCONTO_MINIMO_SEM_JUROS = TABELA_SEM_JUROS[TABELA_SEM_JUROS.length - 1].descontoMinimo;

/** Desconto máximo que a operação retém; o excedente volta para o cliente. */
export const DESCONTO_MAXIMO_RETIDO = 0.35;

/** Acima deste desconto começa o repasse ao cliente. */
export const DESCONTO_INICIO_REPASSE = 0.30;

export const PARCELA_MINIMA_CENTS = 2000;

/**
 * Como interpretar o limite de 35% quando o desconto passa de 30%:
 *  - 'sobre_a_divida': a operação retém até 35% DA DÍVIDA (total do cliente = à vista + 35% × dívida).
 *  - 'sobre_o_desconto': a operação retém 35% DO VALOR DO DESCONTO (total = à vista + 35% × desconto).
 * Pendente de confirmação com o negócio; o restante do código não muda ao trocar aqui.
 */
export const MODO_LIMITE_RETIDO: 'sobre_a_divida' | 'sobre_o_desconto' = 'sobre_a_divida';

export interface EntradaSemJuros {
  dividaCents: number;
  aVistaCents: number;
  /** Quanto o cliente paga no PIX (pagamento combinado). Padrão 0. */
  pixCents?: number;
}

export interface OpcaoParcela {
  parcelas: number;
  /** Valor das parcelas 1..n-1 (a última absorve o resto de centavos). */
  valorParcelaCents: number;
  ultimaParcelaCents: number;
  totalCents: number;
}

export interface ResultadoSemJuros {
  valido: boolean;
  erro?: string;

  dividaCents: number;
  aVistaCents: number;
  /** Desconto concedido pelo credor (dívida − à vista). */
  descontoCents: number;
  /** Fração 0..1. */
  descontoPct: number;

  /** Desconto ≥ 20%: existe opção sem juros. */
  elegivel: boolean;
  /** 0 quando não elegível. */
  parcelasMaximas: number;

  /** Fração do desconto retida pela operação (≤ 35%). */
  descontoRetidoPct: number;
  descontoRetidoCents: number;
  /** Total que o cliente paga (PIX + cartão). */
  totalClienteCents: number;
  /** Parte do desconto repassada ao cliente (dívida − total do cliente). */
  abatimentoCents: number;

  pixCents: number;
  cartaoCents: number;
  /** Total do cliente − valor à vista: cobre a taxa do Quita+ e a margem. */
  margemOperacaoCents: number;

  /** Opções de parcelamento sem juros para o valor do cartão (vazio se não elegível ou cartão = 0). */
  opcoes: OpcaoParcela[];
}

function faixaPara(descontoPct: number): number {
  for (const faixa of TABELA_SEM_JUROS) {
    if (descontoPct + 1e-9 >= faixa.descontoMinimo) return faixa.parcelasMaximas;
  }
  return 0;
}

/** Divide `totalCents` em `n` parcelas; a última absorve a diferença de centavos. */
export function dividirParcelas(totalCents: number, n: number): OpcaoParcela {
  const base = Math.floor(totalCents / n);
  const ultima = totalCents - base * (n - 1);
  return { parcelas: n, valorParcelaCents: base, ultimaParcelaCents: ultima, totalCents };
}

export function calcularSemJuros(entrada: EntradaSemJuros): ResultadoSemJuros {
  const dividaCents = Math.round(entrada.dividaCents || 0);
  const aVistaCents = Math.round(entrada.aVistaCents || 0);
  const pixCents = Math.max(0, Math.round(entrada.pixCents || 0));

  const vazio: ResultadoSemJuros = {
    valido: false,
    dividaCents, aVistaCents, descontoCents: 0, descontoPct: 0,
    elegivel: false, parcelasMaximas: 0,
    descontoRetidoPct: 0, descontoRetidoCents: 0, totalClienteCents: 0, abatimentoCents: 0,
    pixCents, cartaoCents: 0, margemOperacaoCents: 0, opcoes: [],
  };

  if (dividaCents <= 0) return { ...vazio, erro: 'Informe o valor da dívida.' };
  if (aVistaCents <= 0) return { ...vazio, erro: 'Informe o valor à vista.' };
  if (aVistaCents > dividaCents) return { ...vazio, erro: 'O valor à vista não pode ser maior que a dívida.' };

  const descontoCents = dividaCents - aVistaCents;
  const descontoPct = descontoCents / dividaCents;
  const parcelasMaximas = faixaPara(descontoPct);
  const elegivel = parcelasMaximas > 0;

  // Quanto do desconto a operação retém e quanto volta para o cliente
  let descontoRetidoCents: number;
  if (descontoPct <= DESCONTO_INICIO_REPASSE) {
    descontoRetidoCents = descontoCents; // cliente paga a dívida integral
  } else if (MODO_LIMITE_RETIDO === 'sobre_a_divida') {
    descontoRetidoCents = Math.min(descontoCents, Math.round(dividaCents * DESCONTO_MAXIMO_RETIDO));
  } else {
    descontoRetidoCents = Math.round(descontoCents * DESCONTO_MAXIMO_RETIDO);
  }
  const descontoRetidoPct = descontoRetidoCents / dividaCents;
  const totalClienteCents = aVistaCents + descontoRetidoCents;
  const abatimentoCents = dividaCents - totalClienteCents;

  if (pixCents > totalClienteCents) {
    return {
      ...vazio,
      descontoCents, descontoPct, elegivel, parcelasMaximas,
      descontoRetidoPct, descontoRetidoCents, totalClienteCents, abatimentoCents,
      erro: 'O valor do PIX não pode ser maior que o total a pagar pelo cliente.',
    };
  }

  const cartaoCents = totalClienteCents - pixCents;
  const margemOperacaoCents = totalClienteCents - aVistaCents;

  const opcoes: OpcaoParcela[] = [];
  if (elegivel && cartaoCents > 0) {
    for (let n = 1; n <= parcelasMaximas; n++) {
      const opcao = dividirParcelas(cartaoCents, n);
      if (n > 1 && opcao.valorParcelaCents < PARCELA_MINIMA_CENTS) break; // parcelas só diminuem daqui em diante
      opcoes.push(opcao);
    }
  }

  return {
    valido: true,
    dividaCents, aVistaCents, descontoCents, descontoPct,
    elegivel, parcelasMaximas,
    descontoRetidoPct, descontoRetidoCents, totalClienteCents, abatimentoCents,
    pixCents, cartaoCents, margemOperacaoCents, opcoes,
  };
}

export function formatarPct(fracao: number, casas = 1): string {
  return `${(fracao * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Dados levados do simulador para a tela de nova cobrança. */
export interface SemJurosPrefill {
  dividaCents: number;
  aVistaCents: number;
  descontoCents: number;
  pixCents: number;
  cartaoCents: number;
  totalClienteCents: number;
  abatimentoCents: number;
  parcelasMaximas: number;
  /** Parcela escolhida no simulador (1 = à vista); null quando o PIX cobre tudo. */
  parcelasSelecionadas: number | null;
}

export function montarPrefill(resultado: ResultadoSemJuros, opcao: OpcaoParcela | null): SemJurosPrefill {
  return {
    dividaCents: resultado.dividaCents,
    aVistaCents: resultado.aVistaCents,
    descontoCents: resultado.descontoCents,
    pixCents: resultado.pixCents,
    cartaoCents: resultado.cartaoCents,
    totalClienteCents: resultado.totalClienteCents,
    abatimentoCents: resultado.abatimentoCents,
    parcelasMaximas: resultado.parcelasMaximas,
    parcelasSelecionadas: opcao?.parcelas ?? null,
  };
}
