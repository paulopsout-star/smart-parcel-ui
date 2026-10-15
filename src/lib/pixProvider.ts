export type PixProvider = 'treeal' | 'abacatepay';

/**
 * Provedor usado para GERAR novos QR Codes PIX.
 *
 * Contingência (out/2026): AbacatePay enquanto a API PIX da Treeal estiver instável.
 * Para voltar à Treeal, troque o padrão abaixo para 'treeal' (ou defina
 * VITE_PIX_PROVIDER=treeal no build). QRs já emitidos continuam sendo consultados
 * no provedor que os gerou — ver pixStatusFunctionFor.
 */
const DEFAULT_PIX_PROVIDER: PixProvider = 'abacatepay';

const envProvider = import.meta.env.VITE_PIX_PROVIDER as string | undefined;
export const ACTIVE_PIX_PROVIDER: PixProvider =
  envProvider === 'treeal' || envProvider === 'abacatepay' ? envProvider : DEFAULT_PIX_PROVIDER;

const CREATE_FUNCTIONS: Record<PixProvider, string> = {
  treeal: 'treeal-pix-create',
  abacatepay: 'abacatepay-pix-create',
};

const STATUS_FUNCTIONS: Record<PixProvider, string> = {
  treeal: 'treeal-pix-status',
  abacatepay: 'abacatepay-pix-status',
};

export const PIX_CREATE_FUNCTION = CREATE_FUNCTIONS[ACTIVE_PIX_PROVIDER];

/** Identifica o provedor pelo formato do ID salvo em mp_payment_id. */
export function pixProviderOf(paymentId: string | null | undefined): PixProvider | null {
  if (!paymentId) return null;
  if (paymentId.startsWith('pix_char_')) return 'abacatepay';
  if (/^[a-f0-9]{32}$/.test(paymentId)) return 'treeal';
  return null;
}

/** Função de status para um QR já emitido — sempre consulta o provedor que o gerou. */
export function pixStatusFunctionFor(paymentId: string | null | undefined): string {
  return STATUS_FUNCTIONS[pixProviderOf(paymentId) ?? ACTIVE_PIX_PROVIDER];
}

/** QR reaproveitável: emitido pelo provedor ativo e ainda aguardando pagamento. */
export function isReusablePixQr(split: {
  mp_payment_id: string | null;
  mp_qr_code: string | null;
  mp_status: string | null;
}): boolean {
  return (
    !!split.mp_payment_id &&
    !!split.mp_qr_code &&
    pixProviderOf(split.mp_payment_id) === ACTIVE_PIX_PROVIDER &&
    ['ATIVA', 'PENDING'].includes(split.mp_status ?? '')
  );
}
