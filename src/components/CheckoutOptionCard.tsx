import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PaymentOption } from '@/types/payment-options';
import { formatCurrency } from '@/lib/utils';
import { Clock, Zap, TrendingUp, DollarSign } from 'lucide-react';

interface CheckoutOptionCardProps {
  option: PaymentOption;
  isSelected: boolean;
  onSelect: () => void;
  onCustomValueChange?: (desiredValueCents: number) => void;
  customResult?: {
    installments: number;
    totalCents: number;
    installmentValueCents: number;
  } | null;
}

export const CheckoutOptionCard: React.FC<CheckoutOptionCardProps> = ({
  option,
  isSelected,
  onSelect,
  onCustomValueChange,
  customResult
}) => {
  const [localAmount, setLocalAmount] = useState('');

  const handleAmountChange = (value: string) => {
    setLocalAmount(value);
    const cleanValue = value.replace(/[^\d]/g, '');
    const cents = parseInt(cleanValue) || 0;
    
    if (onCustomValueChange && cents > 0) {
      onCustomValueChange(cents);
    }
  };

  const renderOptionContent = () => {
    if (option.isCustom) {
      return (
        <div className="space-y-3">
          {customResult ? (
            <>
              <div className="text-2xl font-bold text-ink">
                {formatCurrency(customResult.installmentValueCents)}
              </div>
              <div className="text-sm text-ink-secondary">
                <strong>{customResult.installments}x</strong> de{' '}
                <strong>{formatCurrency(customResult.installmentValueCents)}</strong>
                {' '}= Total <strong>{formatCurrency(customResult.totalCents)}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-ink">R$ 0,00</div>
              <div className="text-sm text-ink-secondary">
                Digite o valor da parcela desejada
              </div>
            </>
          )}
          
          <div className="space-y-3">
            <Input
              type="text"
              placeholder="Ex: 50,00"
              value={localAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="text-sm bg-gray-50 border-gray-200"
            />
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
          
          {option.discountCents && option.discountCents > 0 && (
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
        return 'Pagamento único sem parcelamento';
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