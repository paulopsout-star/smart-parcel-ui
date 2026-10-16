/**
 * Regras de negócio sobre cobranças compartilhadas entre telas.
 * A edge function update-charge aplica as mesmas regras no servidor.
 */

export interface ChargeEditabilityInput {
  status: string;
  splits?: Array<{ method: string; status: string; pre_payment_key?: string | null }>;
}

/** Só cobranças Pendentes podem ser editadas; qualquer outro status bloqueia. */
export function canEditCharge(charge: ChargeEditabilityInput): { ok: boolean; reason?: string } {
  if (charge.status !== 'pending') {
    return { ok: false, reason: 'Somente cobranças com status Pendente podem ser editadas.' };
  }
  const splits = charge.splits ?? [];
  if (splits.some((s) => s.status === 'concluded')) {
    return { ok: false, reason: 'Esta cobrança já tem um pagamento concluído.' };
  }
  if (splits.some((s) => s.method === 'credit_card' && s.pre_payment_key)) {
    return { ok: false, reason: 'O cartão desta cobrança já foi autorizado.' };
  }
  return { ok: true };
}
