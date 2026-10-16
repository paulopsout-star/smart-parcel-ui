/**
 * Regras de negócio sobre cobranças compartilhadas entre telas.
 * A edge function update-charge aplica as mesmas regras no servidor.
 */

export interface ChargeEditabilityInput {
  status: string;
  splits?: Array<{ method: string; status: string; pre_payment_key?: string | null }>;
}

const EDITABLE_STATUSES = ['pending', 'processing'];

/** Uma cobrança pode ser editada enquanto nenhum pagamento foi concluído nem cartão autorizado. */
export function canEditCharge(charge: ChargeEditabilityInput): { ok: boolean; reason?: string } {
  if (!EDITABLE_STATUSES.includes(charge.status)) {
    return { ok: false, reason: 'A cobrança já avançou no processo de pagamento.' };
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
