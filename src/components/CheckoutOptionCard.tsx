import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PaymentOption } from '@/types/payment-options';
import { formatCurrency } from '@/lib/utils';
import { Clock, Zap, TrendingUp, DollarSign, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  onSelectInstallmentsChange?: (installments: number) => void;
  selectResult?: {
    installments: number;
    totalCents: number;
    installmentValueCents: number;
  } | null;
  installmentConditions?: { installments: number; totalAmount: number; installmentAmount: number }[];
}

export const CheckoutOptionCard: React.FC<CheckoutOptionCardProps> = ({
  option,
  isSelected,
  onSelect,
  onCustomValueChange,
  customResult,
  onSelectInstallmentsChange,
  selectResult,
  installmentConditions
}) => {
  const [localAmount, setLocalAmount] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleAmountChange = (value: string) => {
    const cleanValue = value.replace(/[^\d,]/g, '');
    setLocalAmount(cleanValue);
    
    if (!cleanValue) {
      setIsSearching(false);
      if (onCustomValueChange) {
        onCustomValueChange(0);
      }
      return;
    }
    
    let cents = 0;
    if (cleanValue.includes(',')) {
      const parts = cleanValue.split(',');
      const reais = parseInt(parts[0]) || 0;
      const centavos = parts[1] ? parseInt(parts[1].padEnd(2, '0').slice(0, 2)) : 0;
      cents = reais * 100 + centavos;
    } else {
      cents = (parseInt(cleanValue) || 0) * 100;
    }
    
    if (cents > 0) {
      onSelect(); // Seleciona o card ao digitar valor
      if (onCustomValueChange) {
        setIsSearching(true);
        setTimeout(() => {
          onCustomValueChange(cents);
          setIsSearching(false);
        }, 300);
      }
    }
  };

  const handleInstallmentSelect = (value: string) => {
    console.log('[CheckoutOptionCard] handleInstallmentSelect:', value);
    const installments = parseInt(value, 10);
    if (installments > 0) {
      console.log('[CheckoutOptionCard] Calling onSelect and onSelectInstallmentsChange');
      onSelect(); // Seleciona o card ao escolher parcelas
      if (onSelectInstallmentsChange) {
        onSelectInstallmentsChange(installments);
      }
    }
  };

  const renderOptionContent = () => {
    // Opção de Seleção de Parcelas
    if (option.isSelectInstallments) {
      return (
        <div className="space-y-3">
          {selectResult ? (
            <>
              <div className="flex flex-wrap items-baseline gap-1">
                <span className="text-xl font-semibold tracking-tight text-foreground">
                  {formatCurrency(selectResult.installmentValueCents)}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  em {selectResult.installments}x
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Total: {formatCurrency(selectResult.totalCents)}
              </p>
            </>
          ) : (
            <>
              <div className="text-xl font-semibold text-muted-foreground">R$ --,--</div>
              <p className="text-xs text-muted-foreground">
                Selecione a quantidade de parcelas
              </p>
            </>
          )}
          
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <Select onValueChange={handleInstallmentSelect} value={selectResult ? String(selectResult.installments) : undefined}>
              <SelectTrigger className="h-10 bg-background border-border rounded-xl">
                <SelectValue placeholder="Selecione as parcelas" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border z-50">
                {installmentConditions?.map(condition => (
                  <SelectItem key={condition.installments} value={String(condition.installments)}>
                    {condition.installments}x de {formatCurrency(condition.installmentAmount)} (Total: {formatCurrency(condition.totalAmount)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    // Opção de Valor Personalizado
    if (option.isCustom) {
      return (
        <div className="space-y-3">
          {customResult ? (
            <>
              <div className="flex flex-wrap items-baseline gap-1">
                <span className="text-xl font-semibold tracking-tight text-foreground">
                  {formatCurrency(customResult.installmentValueCents)}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  em {customResult.installments}x
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Total: {formatCurrency(customResult.totalCents)}
              </p>
              <div className="p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Parcela mais próxima ao valor desejado</span>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-xl font-semibold text-muted-foreground">R$ --,--</div>
              <p className="text-xs text-muted-foreground">
                Digite o valor da parcela desejada
              </p>
            </>
          )}
          
          <div className="space-y-2 mt-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                R$
              </span>
              <Input
                type="text"
                placeholder="0,00"
                value={localAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="h-10 text-sm pl-10 bg-background border-border focus:border-primary rounded-xl"
              />
            </div>
            {isSearching && (
              <p className="text-xs text-primary animate-pulse flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                Buscando parcela mais próxima...
              </p>
            )}
          </div>
        </div>
      );
    }

    // Opções padrão (À vista, Popular, Menor valor)
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-1">
          <span className="text-xl font-semibold tracking-tight text-foreground">
            {option.installments === 1 ? (
              formatCurrency(option.totalCents)
            ) : (
              formatCurrency(option.installmentValueCents)
            )}
          </span>
          {option.installments > 1 && (
            <span className="text-xs font-medium text-muted-foreground">
              em {option.installments}x
            </span>
          )}
        </div>
        
        {option.installments > 1 && option.totalCents > 0 && (
          <p className="text-xs text-muted-foreground">
            Total: {formatCurrency(option.totalCents)}
          </p>
        )}
        
        {option.discountCents && option.discountCents > 0 && (
          <p className="text-xs text-primary font-medium mt-1">
            Economize {formatCurrency(option.discountCents)}
          </p>
        )}
      </div>
    );
  };

  const getOptionIcon = () => {
    const iconClass = "w-4 h-4";
    switch (option.type) {
      case 'minimum':
        return <Clock className={iconClass} />;
      case 'single':
        return <Zap className={iconClass} />;
      case 'popular':
        return <TrendingUp className={iconClass} />;
      case 'select':
        return <ListOrdered className={iconClass} />;
      case 'custom':
        return <DollarSign className={iconClass} />;
      default:
        return <DollarSign className={iconClass} />;
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
      case 'select':
        return 'Escolha quantas vezes deseja parcelar';
      case 'custom':
        return 'Escolha o valor da parcela que cabe no seu bolso';
      default:
        return '';
    }
  };

  return (
    <div className="relative">
      {option.type === 'popular' && (
        <Badge className="absolute -top-3 left-4 z-10 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium border-0">
          Mais escolhido
        </Badge>
      )}
      
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full text-left transition-all duration-200",
          "rounded-2xl border bg-card px-5 py-4",
          "flex flex-col gap-3",
          "hover:bg-muted/60 hover:shadow-md",
          isSelected && "border-2 border-primary bg-background shadow-md",
          !isSelected && "border-border"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0",
              option.type === 'popular' 
                ? "bg-primary text-primary-foreground shadow-md" 
                : "bg-primary/10 text-primary"
            )}>
              {getOptionIcon()}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {option.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {getOptionDescription()}
              </p>
            </div>
          </div>
        </div>
        
        {renderOptionContent()}
      </button>
    </div>
  );
};