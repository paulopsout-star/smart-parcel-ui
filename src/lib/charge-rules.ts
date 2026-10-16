/**
 * Regras de negócio sobre cobranças compartilhadas entre telas.
 * A edge function update-charge aplica as mesmas regras no servidor.
 */

export interface ChargeSplitLike {
  method: string;
  status: string;
  amount_cents?: number;
  pre_payment_key?: string | null;
}

export interface ChargeEditabilityInput {
  status: string;
  payment_method?: string | null;
  splits?: ChargeSplitLike[];
}

/** Status que contam como "cobrança em aberto" (mesma lista da situação "Em andamento"). */
export const OPEN_CHARGE_STATUSES = [
  'pending',
  'processing',
  'pre_authorized',
  'boleto_linked',
  'awaiting_validation',
  'validating',
  'approved',
] as const;

export type PaymentMethod = 'pix' | 'cartao' | 'cartao_pix';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  cartao: 'Cartão',
  cartao_pix: 'PIX + Cartão',
};

/** Soma dos PIX já pagos (splits concluded). Esse valor fica travado na edição. */
export function paidPixCents(charge: { splits?: ChargeSplitLike[] }): number {
  return (charge.splits ?? [])
    .filter((s) => s.method === 'pix' && s.status === 'concluded')
    .reduce((sum, s) => sum + (s.amount_cents ?? 0), 0);
}

/**
 * Uma cobrança pode ser editada enquanto estiver Pendente e o cartão não tiver sido
 * autorizado nem pago. PIX já pago não impede a edição (combinado): ele fica travado e o
 * saldo pode ser redistribuído entre um novo PIX e o cartão.
 */
export function canEditCharge(charge: ChargeEditabilityInput): { ok: boolean; reason?: string } {
  if (charge.status !== 'pending') {
    return { ok: false, reason: 'Somente cobranças com status Pendente podem ser editadas.' };
  }
  const splits = charge.splits ?? [];
  const card = splits.filter((s) => s.method === 'credit_card');
  if (card.some((s) => s.status === 'concluded')) {
    return { ok: false, reason: 'O cartão desta cobrança já foi pago.' };
  }
  if (card.some((s) => s.pre_payment_key)) {
    return { ok: false, reason: 'O cartão desta cobrança já foi autorizado.' };
  }
  const pixPaid = splits.some((s) => s.method === 'pix' && s.status === 'concluded');
  if (pixPaid && charge.payment_method !== 'cartao_pix') {
    return { ok: false, reason: 'Esta cobrança PIX já foi paga.' };
  }
  return { ok: true };
}

/** O tipo de pagamento só pode mudar enquanto nenhum valor foi pago. */
export function canChangePaymentMethod(charge: ChargeEditabilityInput): { ok: boolean; reason?: string } {
  const editable = canEditCharge(charge);
  if (!editable.ok) return editable;
  if (paidPixCents(charge) > 0) {
    return { ok: false, reason: 'Já existe PIX pago; o tipo de pagamento não pode ser alterado.' };
  }
  return { ok: true };
}
