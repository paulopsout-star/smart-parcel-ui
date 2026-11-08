/**
 * Modalidade "sem juros" — tudo o que o front precisa para rotear entre o fluxo atual do Quita+
 * e as funções isoladas `quitaplus-sj-*`.
 *
 * Regra de isolamento: as páginas atuais só importam daqui; com o interruptor desligado e sem
 * cobranças da modalidade, nada aqui muda o comportamento de hoje.
 */

export type Modalidade = 'com_juros' | 'sem_juros';

/** Nome da função de borda a chamar conforme a modalidade da cobrança. */
export function fnPorModalidade(
  base: 'quitaplus-prepayment' | 'quitaplus-link-boleto' | 'quitaplus-prepayment-status' | 'inter-boleto-issue',
  modalidade: Modalidade | null | undefined,
): string {
  if (modalidade !== 'sem_juros') return base;
  switch (base) {
    case 'quitaplus-prepayment': return 'quitaplus-sj-prepayment';
    case 'quitaplus-link-boleto': return 'quitaplus-sj-link-boleto';
    case 'quitaplus-prepayment-status': return 'quitaplus-sj-status';
    case 'inter-boleto-issue': return 'quitaplus-sj-boleto-inter';
  }
}

/** Dados gravados em charges.metadata.sem_juros (normalizados pelo gatilho do banco). */
/* type (não interface): precisa ser atribuível a Json ao gravar metadata */
export type SemJurosMetadata = {
  divida_cents: number;
  a_vista_cents: number;
  desconto_cents: number;
  desconto_pct?: number;
  desconto_retido_cents?: number;
  pix_cents: number;
  cartao_cents: number;
  total_cliente_cents: number;
  abatimento_cents: number;
  parcelas_maximas: number;
  parcelas_selecionadas: number | null;
  boleto_valor_cents?: number | null;
  validado_em?: string;
};

/** Carimbo gravado em charges.metadata.simulacao quando a simulação cai no fluxo com juros. */
export type SimulacaoMetadata = {
  divida_cents: number;
  a_vista_cents: number;
  desconto_pct: number;
  pix_cents: number;
  cartao_cents: number;
  modalidade: 'com_juros';
  motivo: 'desconto_abaixo_de_20';
};

/** Prefill levado do simulador para a nova cobrança quando o desconto NÃO habilita o sem juros. */
export interface ComJurosPrefill {
  dividaCents: number;
  aVistaCents: number;
  descontoPct: number;
  pixCents: number;
  cartaoCents: number;
  /** Parcela escolhida na simulação do Quita+ (1 = à vista); null se não escolheu. */
  parcelasSelecionadas: number | null;
}

export function lerSemJuros(metadata: unknown): SemJurosMetadata | null {
  const sj = (metadata as { sem_juros?: SemJurosMetadata } | null | undefined)?.sem_juros;
  return sj && typeof sj === 'object' && Number(sj.divida_cents) > 0 ? sj : null;
}

/** Mensagens do gatilho do banco (hint) → texto para o operador. */
export function mensagemErroSemJuros(err: unknown): string | null {
  const e = err as { message?: string; hint?: string; details?: string } | null;
  const texto = `${e?.message ?? ''} ${e?.hint ?? ''} ${e?.details ?? ''}`;
  if (/sem_juros_simulacao_obrigatoria|precisa começar pela simulação/i.test(texto)) {
    return 'Para o seu usuário, a cobrança com cartão precisa começar pela simulação. Clique em "Simular Pagamento".';
  }
  if (/sem_juros_desativado|Modalidade sem juros desativada/i.test(texto)) {
    return 'A modalidade sem juros está desativada no momento. Refaça a simulação ou fale com o administrador.';
  }
  if (/sem_juros_nao_habilitado/i.test(texto)) return 'Seu usuário não está habilitado para a modalidade sem juros.';
  if (/sem_juros_nao_elegivel|abaixo de 20%/i.test(texto)) return 'O desconto do credor é menor que 20%: a cobrança deve seguir o fluxo com juros. Refaça a simulação.';
  if (/sem_juros_valor_divergente|difere do total sem juros/i.test(texto)) return 'O valor da cobrança não bate com a simulação. Refaça a simulação.';
  if (/sem_juros_split_divergente/i.test(texto)) return 'PIX e cartão não batem com a simulação. Refaça a simulação.';
  if (/sem_juros_parcelas|fora da faixa sem juros/i.test(texto)) return 'Quantidade de parcelas acima do permitido para este desconto.';
  if (/sem_juros_parcela_minima|Parcela abaixo de R\$ 20/i.test(texto)) return 'A parcela ficaria abaixo de R$ 20,00. Reduza o número de parcelas.';
  return null;
}
