import React from 'react';
import { Button } from '@/components/ui/button';
import { PaymentOption } from '@/types/payment-options';
import { CheckoutCharge } from '@/hooks/useCheckoutStore';
import { formatCurrency } from '@/lib/utils';

interface CheckoutSummaryProps {
  charge: CheckoutCharge;
  selectedOption: PaymentOption | null;
  onContinue: () => void;
  disabled: boolean;
}

export const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({
  charge,
  selectedOption,
  onContinue,
  disabled
}) => {
  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
      <div className="space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-border">
          <div className="text-sm text-muted-foreground">
            {charge.title}
          </div>
          <div className="text-lg font-semibold text-foreground">
            {formatCurrency(charge.totalCents)}
          </div>
        </div>
        
        <Button
          onClick={onContinue}
          disabled={disabled}
          className="w-full h-11 rounded-full text-sm font-semibold"
          size="lg"
        >
          Continuar para o Checkout
        </Button>
        
        <div className="text-center text-xs text-muted-foreground leading-relaxed">
          Ao continuar, você concorda com nossos{' '}
          <a href="#" className="text-primary hover:underline">
            Termos de Uso
          </a>{' '}
          e{' '}
          <a href="#" className="text-primary hover:underline">
            Política de Privacidade
          </a>
        </div>
      </div>
    </div>
  );
};