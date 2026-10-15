// Types para integração com API QuitaMais
export interface PaymentRequest {
  merchantId: string;
  creditorName: string;
  creditorDocument: string;
  amountInCents: number;
  installments: number;
  payerDocument: string;
  payerEmail: string;
  payerPhoneNumber: string;
  payerName: string;
  cardHolderName: string;
  cardNumber: string;
  cardExpirationDate: string; // formato yyyy/mm
  cardCvv: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  prePaymentKey?: string;
  authorizationCode?: string;
  status?: 'AUTHORIZED' | 'REJECTED' | 'PENDING' | 'LINKED';
  message?: string;
  error?: string;
  errorDetails?: {
    code: string;
    message: string;
  };
}

/** Vínculo do cliente com o portador do cartão (enum card_holder_relationship no banco). */
export type CardHolderRelationship =
  | 'self'
  | 'spouse'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'uncle_aunt'
  | 'cousin'
  | 'grandparent'
  | 'friend';

export const CARD_HOLDER_RELATIONSHIPS: ReadonlyArray<{ value: CardHolderRelationship; label: string }> = [
  { value: 'self', label: 'Sou o portador do cartão' },
  { value: 'spouse', label: 'Cônjuge' },
  { value: 'parent', label: 'Pai/Mãe' },
  { value: 'child', label: 'Filho(a)' },
  { value: 'sibling', label: 'Irmão/Irmã' },
  { value: 'uncle_aunt', label: 'Tio(a)' },
  { value: 'cousin', label: 'Primo(a)' },
  { value: 'grandparent', label: 'Vô/Vó' },
  { value: 'friend', label: 'Amigo(a)' },
];

export const cardHolderRelationshipLabel = (value: string | null | undefined): string =>
  CARD_HOLDER_RELATIONSHIPS.find((r) => r.value === value)?.label ?? 'Não informado';

/** Dados do portador do cartão enviados ao backend (guardados em card_holder_details). */
export interface CardHolderData {
  name: string;
  document: string;       // só dígitos
  birthDate: string | null; // YYYY-MM-DD
  phone: string;          // só dígitos
  email: string;
  relationship: CardHolderRelationship;
}

export interface QuitaPlusPrePaymentRequest {
  chargeId: string;
  paymentLinkId: string;
  amount: number;
  installments: number;
  card: {
    holderName: string;
    number: string;
    expirationDate: string;
    cvv: string;
  };
  cardHolder: CardHolderData;
  /**
   * Legado / ferramenta de teste do admin. Quando há chargeId/paymentLinkId o backend
   * IGNORA este campo e usa o pagador do cadastro da cobrança.
   */
  payer?: {
    name: string;
    document: string;
    email: string;
    phoneNumber: string;
  };
}

export interface QuitaPlusLinkBoletoRequest {
  prePaymentKey: string;
  paymentLinkId: string;
  boleto: {
    number: string;
    creditorDocument: string;
    creditorName: string;
  };
}

export interface PaymentFormData {
  relationship: CardHolderRelationship | '';
  holderName: string;        // Nome impresso no cartão (vai como CardHolderName ao Quita+)
  holderDocument: string;
  holderBirthDate: string;   // DD/MM/AAAA
  holderPhone: string;
  holderEmail: string;
  cardNumber: string;
  cardExpirationDate: string;
  cardCvv: string;
}

export interface PaymentState {
  isProcessing: boolean;
  isSuccess: boolean;
  error: string | null;
  transactionId: string | null;
}

export type PaymentStatus = 'idle' | 'processing' | 'success' | 'error';
