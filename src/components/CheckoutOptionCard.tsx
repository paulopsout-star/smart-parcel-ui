import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PaymentOption } from '@/pages/Checkout';
import { formatCurrency } from '@/lib/utils';
import { validateCustomPayment, distributeCentsInInstallments } from '@/lib/checkout-utils';
import { CheckCircle, Circle } from 'lucide-react';

interface CheckoutOptionCardProps {
  option: PaymentOption;
  isSelected: boolean;
  onSelect: () => void;
  onCustomValueChange?: (amountCents: number, installments: number) => void;
  customAmount?: number;
  customInstallments?: number;
}

export const CheckoutOptionCard: React.FC<CheckoutOptionCardProps> = ({
  option,
  isSelected,
  onSelect,
  onCustomValueChange,
  customAmount = 0,
  customInstallments = 1
}) => {
  const [localAmount, setLocalAmount] = useState(customAmount ? (customAmount / 100).toFixed(2) : '');
  const [localInstallments, setLocalInstallments] = useState(customInstallments.toString());

  const handleAmountChange = (value: string) => {
    setLocalAmount(value);
    const cents = Math.round(parseFloat(value.replace(',', '.')) * 100) || 0;
    const installments = parseInt(localInstallments) || 1;
    
    if (onCustomValueChange && cents > 0) {
      onCustomValueChange(cents, installments);
    }
  };

  const handleInstallmentsChange = (value: string) => {
    setLocalInstallments(value);
    const installments = parseInt(value) || 1;
    const cents = Math.round(parseFloat(localAmount.replace(',', '.')) * 100) || 0;
    
    if (onCustomValueChange && cents > 0) {
      onCustomValueChange(cents, installments);
    }
  };

  const renderOptionContent = () => {
    if (option.isCustom) {
      const amountCents = Math.round(parseFloat(localAmount.replace(',', '.')) * 100) || 0;
      const installments = parseInt(localInstallments) || 1;
      const validation = validateCustomPayment(amountCents, installments);
      
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="custom-amount" className="text-sm font-medium text-ink">
                Valor Total (R$)
              </Label>
              <Input
                id="custom-amount"
                type="text"
                placeholder="0,00"
                value={localAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="custom-installments" className="text-sm font-medium text-ink">
                Parcelas
              </Label>
              <Input
                id="custom-installments"
                type="number"
                min="1"
                max="12"
                placeholder="1"
                value={localInstallments}
                onChange={(e) => handleInstallmentsChange(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          
          {!validation.valid && (
            <div className="text-sm text-destructive">
              {validation.errors.map((error, index) => (
                <div key={index}>• {error}</div>
              ))}
            </div>
          )}
          
          {validation.valid && amountCents > 0 && (
            <div className="text-sm text-ink-secondary">
              <div>
                <strong>{installments}x</strong> de{' '}
                <strong>{formatCurrency(Math.floor(amountCents / installments))}</strong>
              </div>
              {installments > 1 && (
                <div className="text-xs text-ink-muted mt-1">
                  * Última parcela: {formatCurrency(amountCents - Math.floor(amountCents / installments) * (installments - 1))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-ink">
              {option.installments === 1 ? (
                formatCurrency(option.totalCents)
              ) : (
                `${option.installments}x de ${formatCurrency(option.installmentValueCents)}`
              )}
            </div>
            {option.installments > 1 && (
              <div className="text-sm text-ink-secondary">
                Total: {formatCurrency(option.totalCents)}
              </div>
            )}
          </div>
          {option.discountCents && (
            <Badge variant="default" className="bg-success text-success-foreground">
              Economize {formatCurrency(option.discountCents)}
            </Badge>
          )}
        </div>
        
        {option.type === 'popular' && (
          <Badge variant="secondary" className="text-xs">
            Mais Popular
          </Badge>
        )}
        
        {option.type === 'minimum' && (
          <Badge variant="outline" className="text-xs">
            Menor Parcela
          </Badge>
        )}
      </div>
    );
  };

  return (
    <Card
      className={`p-6 cursor-pointer transition-all duration-200 border-2 ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-lg'
          : 'border-border hover:border-primary/50 hover:shadow-md'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-4">
        <div className="mt-1">
          {isSelected ? (
            <CheckCircle className="w-5 h-5 text-primary" />
          ) : (
            <Circle className="w-5 h-5 text-ink-muted" />
          )}
        </div>
        
        <div className="flex-1">
          <div className="font-medium text-ink mb-3">
            {option.title}
          </div>
          
          {renderOptionContent()}
        </div>
      </div>
    </Card>
  );
};