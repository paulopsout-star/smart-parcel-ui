import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatCents } from '@/lib/currency-utils';
import { usePaymentSimulation } from '@/hooks/usePaymentSimulation';
import { CreditCard, AlertCircle, TrendingDown } from 'lucide-react';
import { InstallmentCondition } from '@/hooks/usePaymentSimulation';

interface PaymentSimulatorProps {
  amountCents: number;
  onSelectInstallment?: (installments: number, totalAmount: number, condition?: InstallmentCondition) => void;
  selectedInstallments?: number;
  title?: string;
  subtitle?: string;
}

export function PaymentSimulator({
  amountCents,
  onSelectInstallment,
  selectedInstallments,
  title,
  subtitle,
}: PaymentSimulatorProps) {
  const { data, isLoading, error } = usePaymentSimulation(amountCents);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {title ?? 'Simulação de Parcelas'}
          </CardTitle>
          <CardDescription>Carregando opções de parcelamento...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Não foi possível simular as parcelas. Tente novamente.
        </AlertDescription>
      </Alert>
    );
  }

  if (!data?.simulation?.conditions || data.simulation.conditions.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Nenhuma opção de parcelamento disponível para este valor.
        </AlertDescription>
      </Alert>
    );
  }

  const conditions = data.simulation.conditions;
  const popularInstallment = 6;
  const minInstallmentCount = Math.max(...conditions.map(c => c.installments));
  const baseAmount = conditions.find(c => c.installments === 1)?.totalAmount ?? amountCents;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {title ?? 'Opções de Parcelamento'}
        </CardTitle>
        <CardDescription>
          {subtitle ?? `Escolha como deseja pagar - Total: ${formatCents(amountCents)}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {conditions.map((condition) => {
          const isSelected = selectedInstallments === condition.installments;
          const isPopular = condition.installments === popularInstallment;
          const isMinInstallment = condition.installments === minInstallmentCount && minInstallmentCount > 1;
          const fee = condition.totalAmount - baseAmount;
          const feePct = baseAmount > 0 ? (fee / baseAmount) * 100 : 0;

          return (
            <button
              key={condition.installments}
              onClick={() => onSelectInstallment?.(condition.installments, condition.totalAmount, condition)}
              className={`
                w-full p-4 rounded-lg border-2 transition-all duration-200 text-left
                hover:border-primary hover:bg-accent/50 hover:shadow-md
                ${isSelected
                  ? 'border-primary bg-accent shadow-sm'
                  : 'border-border bg-card'
                }
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-foreground">
                      {condition.installments}x de {formatCents(condition.installmentAmount)}
                    </span>
                    {isPopular && (
                      <Badge variant="secondary" className="text-xs">
                        Mais Escolhido
                      </Badge>
                    )}
                    {condition.installments === 1 && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                        Menor juros
                      </Badge>
                    )}
                    {isMinInstallment && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        Menor parcela
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>Total: {formatCents(condition.totalAmount)}</span>
                    {fee > 0 && (
                      <span className="text-red-400">
                        +{formatCents(fee)} ({feePct.toFixed(1)}% juros)
                      </span>
                    )}
                    {fee === 0 && (
                      <span className="text-green-600">sem juros</span>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
