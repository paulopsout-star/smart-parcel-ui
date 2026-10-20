/**
 * Derivação do status da cobrança (charges.status) a partir dos splits.
 *
 * Fonte única usada por sync-card-status, conclude-card-payment e sync-payment-status.
 * Antes, cada uma tinha a própria versão e todas reduziam o cartão "em andamento" a
 * "processing", apagando o pre_authorized gravado pela quitaplus-prepayment — por isso o
 * filtro "Pré-autorizado" (cartão autorizado aguardando vínculo do boleto) nunca encontrava
 * cobranças combinadas.
 *
 * Regra: a etapa do split de cartão (vinda do statusCode do Quita+) vira o status da cobrança
 * enquanto o cartão estiver em andamento. Pagamento parcial sem etapa de cartão continua
 * "processing", como sempre foi.
 */

export interface SplitLike {
  method: string;
  status: string;
}

/** Etapas do cartão que se refletem diretamente na cobrança (statusCode Quita+ → split → charge). */
const CARD_STAGE_TO_CHARGE: Record<string, string> = {
  analyzing: "pre_authorized",            // 1 Received — autorizado, aguardando vínculo do boleto
  boleto_linked: "boleto_linked",         // 3 BarcodeAssigned
  awaiting_validation: "awaiting_validation", // 7 AwaitingPayerValidation — aguardando PIN
  validating: "validating",               // 4 Settled / 8 ValidatingPayment — análise de risco
  approved: "approved",                   // 6 PaymentValidated
};

export function deriveChargeStatus(splits: SplitLike[]): string {
  if (!splits || splits.length === 0) return "pending";

  const active = splits.filter((s) => s.status !== "cancelled");
  const isConcluded = (s: SplitLike) => s.status === "concluded";
  const isFailed = (s: SplitLike) => s.status === "failed" || s.status === "expired";
  const anyConcluded = splits.some(isConcluded);

  // Completa só quando CADA método presente na cobrança tem um split concluído (mesma regra do
  // tryCompleteCharge). Cancelados contam para "método presente": PIX pago + cartão cancelado
  // NÃO é cobrança paga.
  const methods = Array.from(new Set(splits.map((s) => s.method)));
  const allMethodsCovered = methods.every((m) => splits.some((s) => s.method === m && isConcluded(s)));
  if (allMethodsCovered) return "completed";

  // Cartão em andamento manda no status da cobrança (mesmo com PIX já pago no combinado)
  const cardStage = active.find((s) => s.method === "credit_card" && CARD_STAGE_TO_CHARGE[s.status]);
  if (cardStage) return CARD_STAGE_TO_CHARGE[cardStage.status];

  if (splits.some((s) => s.status === "cancelled") && !anyConcluded && active.length === 0) return "cancelled";
  if (splits.some(isFailed) && !anyConcluded && !active.some((s) => s.status === "pending")) return "failed";
  if (anyConcluded) return "processing"; // parcialmente pago
  return "pending";
}
