import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PaymentOption } from '@/pages/Checkout';
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
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-ink">
          <ShoppingCart className="w-5 h-5" />
          <h3 className="font-semibold">Resumo do Pedido</h3>
        </div>
        
        <Separator />
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-ink-secondary">Produto</span>
            <span className="text-ink font-medium">{charge.title}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-ink-secondary">Valor Original</span>
            <span className="text-ink">{formatCurrency(charge.totalCents)}</span>
          </div>
          
          {selectedOption?.discountCents && (
            <div className="flex justify-between text-sm">
              <span className="text-success">Desconto À Vista</span>
              <span className="text-success font-medium">
                -{formatCurrency(selectedOption.discountCents)}
              </span>
            </div>
          )}
          
          {selectedOption && (
            <div className="flex justify-between text-sm">
              <span className="text-ink-secondary">Forma de Pagamento</span>
              <div className="text-right">
                <div className="text-ink font-medium">
                  {selectedOption.installments === 1 
                    ? 'À vista' 
                    : `${selectedOption.installments}x`
                  }
                </div>
                {selectedOption.installments > 1 && (
                  <div className="text-xs text-ink-muted">
                    {formatCurrency(selectedOption.installmentValueCents)} cada
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <Separator />
        
        <div className="flex justify-between items-center">
          <span className="font-semibold text-ink">Total</span>
          <span className="text-xl font-bold text-primary">
            {selectedOption 
              ? formatCurrency(selectedOption.totalCents)
              : formatCurrency(charge.totalCents)
            }
          </span>
        </div>
        
        <Button
          onClick={onContinue}
          disabled={disabled}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          size="lg"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Continuar para o Checkout
        </Button>
        
        {disabled && (
          <p className="text-xs text-ink-muted text-center">
            Selecione uma opção de pagamento para continuar
          </p>
        )}
      </div>
    </Card>
  );
};