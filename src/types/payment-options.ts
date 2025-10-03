export interface PaymentOption {
  id: string;
  title: string;
  type: 'single' | 'popular' | 'minimum' | 'custom';
  totalCents: number;
  installments: number;
  installmentValueCents: number;
  discountCents?: number;
  isCustom?: boolean;
}
