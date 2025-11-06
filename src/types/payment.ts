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
  payer: {
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
  payerName: string;
  payerDocument: string;
  payerEmail: string;
  payerPhoneNumber: string;
  cardHolderName: string;
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