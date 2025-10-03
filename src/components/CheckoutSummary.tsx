import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PaymentOption } from '@/types/payment-options';
import { CheckoutCharge } from '@/hooks/useCheckoutStore';
import { formatCurrency } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, CreditCard } from 'lucide-react';

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
    <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
      <div className="space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
          <div className="text-sm text-ink-secondary">
            {charge.title}
          </div>
          <div className="text-lg font-semibold text-ink">
            {formatCurrency(charge.totalCents)}
          </div>
        </div>
        
        <Button
          onClick={onContinue}
          disabled={disabled}
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-4 text-base rounded-lg"
          size="lg"
        >
          Continuar para o Checkout
        </Button>
        
        <div className="text-center text-xs text-ink-muted leading-relaxed">
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