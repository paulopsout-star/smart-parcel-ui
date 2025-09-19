// Types for QuitaMais API integration
export interface Payer {
  name: string; // até 200 chars
  email: string; // até 50 chars
  phoneNumber: string; // até 11 dígitos
  document: string; // CPF/CNPJ apenas dígitos
}

export interface Bankslip {
  number: string; // linha digitável só números
  creditorDocument: string; // ID do credor
  creditorName: string; // até 200 chars
}

export interface Checkout {
  maskFee: boolean; // parcelas fechadas = true, abertas = false
  installments: number | null; // inteiro ou null para deixar em aberto
}

export interface PaymentLinkRequest {
  amount: number; // valor em centavos
  payer: Payer;
  bankslip?: Bankslip;
  checkout: Checkout;
  description?: string;
  orderId?: string;
  expirationDate?: string;
}

export interface PaymentLinkResponse {
  linkId: string;
  linkUrl: string;
  guid: string;
  status: string;
  createdAt: string;
}

export interface AuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: number;
}

export interface PaymentLinkHistory {
  id: string;
  linkId: string;
  linkUrl: string;
  amount: number;
  payerName: string;
  payerEmail: string;
  status: string;
  createdAt: string;
  orderId?: string;
  description?: string;
}

export type OrderType = 'boleto' | 'credit_card' | 'pix' | 'bank_transfer';

export interface QuitaMaisConfig {
  environment: 'sandbox' | 'production';
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface QuitaMaisError {
  code: string;
  message: string;
  details?: any;
}