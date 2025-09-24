import { PaymentOption } from '@/pages/Checkout';

export interface CheckoutConfig {
  oneTimeDiscountPct: number;
  popularInstallments: number;
  maxInstallments: number;
  minInstallmentValueCents: number;
}

export const defaultCheckoutConfig: CheckoutConfig = {
  oneTimeDiscountPct: 0.20, // 20%
  popularInstallments: 6,
  maxInstallments: 12,
  minInstallmentValueCents: 1000 // R$ 10,00
};

export const calculatePaymentOptions = (
  totalCents: number, 
  config: CheckoutConfig = defaultCheckoutConfig
): PaymentOption[] => {
  const options: PaymentOption[] = [];
  
  // 1. Pagamento único com desconto
  const discountCents = Math.floor(totalCents * config.oneTimeDiscountPct);
  const singlePaymentTotal = totalCents - discountCents;
  
  options.push({
    id: 'single',
    title: 'À vista',
    type: 'single',
    totalCents: singlePaymentTotal,
    installments: 1,
    installmentValueCents: singlePaymentTotal,
    discountCents
  });
  
  // 2. Parcelamento Popular
  if (totalCents >= config.popularInstallments * config.minInstallmentValueCents) {
    const installmentValue = Math.floor(totalCents / config.popularInstallments);
    const adjustedTotal = installmentValue * (config.popularInstallments - 1) + 
                         (totalCents - installmentValue * (config.popularInstallments - 1));
    
    options.push({
      id: 'popular',
      title: `${config.popularInstallments}x sem juros`,
      type: 'popular',
      totalCents: adjustedTotal,
      installments: config.popularInstallments,
      installmentValueCents: installmentValue
    });
  }
  
  // 3. Menor Parcela (máximo de parcelas)
  if (totalCents >= config.maxInstallments * config.minInstallmentValueCents) {
    const installmentValue = Math.floor(totalCents / config.maxInstallments);
    const adjustedTotal = installmentValue * (config.maxInstallments - 1) + 
                         (totalCents - installmentValue * (config.maxInstallments - 1));
    
    options.push({
      id: 'minimum',
      title: `${config.maxInstallments}x de menor valor`,
      type: 'minimum',
      totalCents: adjustedTotal,
      installments: config.maxInstallments,
      installmentValueCents: installmentValue
    });
  }
  
  // 4. Valor Personalizado (placeholder)
  options.push({
    id: 'custom',
    title: 'Valor Personalizado',
    type: 'custom',
    totalCents: totalCents,
    installments: 1,
    installmentValueCents: totalCents,
    isCustom: true
  });
  
  return options;
};

export const validateCustomPayment = (
  amountCents: number, 
  installments: number,
  config: CheckoutConfig = defaultCheckoutConfig
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (installments < 1 || installments > config.maxInstallments) {
    errors.push(`Número de parcelas deve estar entre 1 e ${config.maxInstallments}`);
  }
  
  const installmentValue = Math.floor(amountCents / installments);
  if (installmentValue < config.minInstallmentValueCents) {
    errors.push(`Valor da parcela mínima é R$ ${(config.minInstallmentValueCents / 100).toFixed(2)}`);
  }
  
  if (amountCents <= 0) {
    errors.push('Valor deve ser maior que zero');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

export const distributeCentsInInstallments = (totalCents: number, installments: number): number[] => {
  const baseValue = Math.floor(totalCents / installments);
  const remainder = totalCents - (baseValue * installments);
  
  const values = Array(installments).fill(baseValue);
  
  // Add remainder to the last installment for exact sum
  if (remainder > 0) {
    values[installments - 1] += remainder;
  }
  
  return values;
};