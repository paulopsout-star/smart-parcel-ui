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
  const [isSearching, setIsSearching] = useState(false);

  const handleAmountChange = (value: string) => {
    // Aceitar apenas números, vírgula e ponto
    const cleanValue = value.replace(/[^\d,]/g, '');
    setLocalAmount(cleanValue);
    
    // Se o campo foi limpo, resetar o estado de busca
    if (!cleanValue) {
      setIsSearching(false);
      if (onCustomValueChange) {
        onCustomValueChange(0); // Notificar pai para limpar resultado
      }
      return;
    }
    
    // Converter para centavos
    let cents = 0;
    if (cleanValue.includes(',')) {
      const parts = cleanValue.split(',');
      const reais = parseInt(parts[0]) || 0;
      const centavos = parts[1] ? parseInt(parts[1].padEnd(2, '0').slice(0, 2)) : 0;
      cents = reais * 100 + centavos;
    } else {
      cents = (parseInt(cleanValue) || 0) * 100;
    }
    
    if (onCustomValueChange && cents > 0) {
      setIsSearching(true);
      // Simular um pequeno delay para mostrar "buscando"
      setTimeout(() => {
        onCustomValueChange(cents);
        setIsSearching(false);
      }, 300);
    }
  };

  const renderOptionContent = () => {
    if (option.isCustom) {
      return (
        <div className="space-y-3">
          {customResult ? (
            <>
              <div className="text-3xl font-bold text-primary animate-in fade-in duration-300">
                {formatCurrency(customResult.installmentValueCents)}
              </div>
              <div className="text-sm text-ink font-medium">
                <strong>{customResult.installments}x</strong> de{' '}
                <strong>{formatCurrency(customResult.installmentValueCents)}</strong>
                {' '}= Total <strong>{formatCurrency(customResult.totalCents)}</strong>
              </div>
              <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/30 animate-in slide-in-from-top duration-300">
                <p className="text-sm text-primary font-medium flex items-center gap-2">
                  <span className="text-lg">✓</span>
                  <span>Parcela mais próxima ao valor desejado</span>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-muted-foreground">R$ --,--</div>
              <div className="text-sm text-ink-secondary">
                Digite o valor da parcela desejada
              </div>
            </>
          )}
          
          <div className="space-y-2 mt-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                R$
              </span>
              <Input
                type="text"
                placeholder="0,00"
                value={localAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="text-base pl-10 bg-background border-border focus:border-primary font-medium"
              />
            </div>
            {isSearching && (
              <p className="text-xs text-primary animate-pulse flex items-center gap-1">
                <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                Buscando parcela mais próxima...
              </p>
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