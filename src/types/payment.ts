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
  status?: 'AUTHORIZED' | 'REJECTED' | 'PENDING';
  message: string;
  authorizationCode?: string;
  errorDetails?: {
    code: string;
    message: string;
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