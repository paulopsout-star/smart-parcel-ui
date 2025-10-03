import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PaymentOption } from '@/types/payment-options';
import { formatCurrency } from '@/lib/utils';
import { validateCustomPayment, distributeCentsInInstallments } from '@/lib/checkout-utils';
import { Clock, Zap, TrendingUp, DollarSign } from 'lucide-react';

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
        <div className="space-y-3">
          <div className="text-2xl font-bold text-ink">
            {validation.valid && amountCents > 0 ? (
              formatCurrency(amountCents)
            ) : (
              'R$ 0,00'
            )}
          </div>
          
          <div className="text-sm text-ink-secondary">
            Digite o valor da parcela desejada
          </div>
          
          <div className="space-y-3">
            <Input
              type="text"
              placeholder="Digite o valor da parcela desejada"
              value={localAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="text-sm bg-gray-50 border-gray-200"
            />
            
            {!validation.valid && validation.errors.length > 0 && (
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
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex flex-col">
          <div className="text-2xl font-bold text-ink mb-1">
            {option.installments === 1 ? (
              formatCurrency(option.totalCents)
            ) : (
              <>
                {formatCurrency(option.installmentValueCents)}{' '}
                <span className="text-base font-normal text-ink-secondary">
                  em {option.installments}x
                </span>
              </>
            )}
          </div>
          
          {option.installments > 1 && (
            <div className="text-sm text-ink-secondary">
              Total: {formatCurrency(option.totalCents)}
            </div>
          )}
          
          {option.discountCents && (
            <div className="text-sm text-primary font-medium mt-1">
              Economize {formatCurrency(option.discountCents)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const getOptionIcon = () => {
    switch (option.type) {
      case 'minimum':
        return <Clock className="w-5 h-5 text-white" />;
      case 'single':
        return <Zap className="w-5 h-5 text-white" />;
      case 'popular':
        return <TrendingUp className="w-5 h-5 text-white" />;
      case 'custom':
        return <DollarSign className="w-5 h-5 text-white" />;
      default:
        return <DollarSign className="w-5 h-5 text-white" />;
    }
  };

  const getOptionDescription = () => {
    switch (option.type) {
      case 'minimum':
        return 'Parcele em mais vezes e pague menos por mês';
      case 'single':
        return 'Pagamento único com desconto especial';
      case 'popular':
        return 'A opção mais escolhida pelos nossos clientes';
      case 'custom':
        return 'Escolha o valor da parcela que cabe no seu bolso';
      default:
        return '';
    }
  };

  return (
    <Card
      className={`p-6 cursor-pointer transition-all duration-200 border ${
        isSelected
          ? 'border-primary bg-white shadow-lg ring-2 ring-primary/20'
          : 'border-gray-200 hover:border-primary/50 hover:shadow-md bg-white'
      } ${option.type === 'popular' ? 'relative' : ''}`}
      onClick={onSelect}
    >
      {option.type === 'popular' && (
        <div className="absolute -top-3 left-6">
          <Badge className="bg-orange-500 text-white px-3 py-1 text-xs font-medium">
            Mais Escolhido
          </Badge>
        </div>
      )}
      
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            {getOptionIcon()}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-col">
            <h3 className="font-semibold text-lg text-ink mb-1">
              {option.title}
            </h3>
            <p className="text-sm text-ink-secondary mb-4">
              {getOptionDescription()}
            </p>
            
            {renderOptionContent()}
          </div>
        </div>
      </div>
    </Card>
  );
};