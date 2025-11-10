import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatCents } from '@/lib/currency-utils';
import { usePaymentSimulation } from '@/hooks/usePaymentSimulation';
import { CreditCard, AlertCircle } from 'lucide-react';

interface PaymentSimulatorProps {
  amountCents: number;
  onSelectInstallment?: (installments: number, totalAmount: number) => void;
  selectedInstallments?: number;
}

export function PaymentSimulator({ 
  amountCents, 
  onSelectInstallment,
  selectedInstallments 
}: PaymentSimulatorProps) {
  const { data, isLoading, error } = usePaymentSimulation(amountCents);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Simulação de Parcelas
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
  const popularInstallment = 6; // Parcelamento popular (6x)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Opções de Parcelamento
        </CardTitle>
        <CardDescription>
          Escolha como deseja pagar - Total: {formatCents(amountCents)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {conditions.map((condition) => {
          const isSelected = selectedInstallments === condition.installments;
          const isPopular = condition.installments === popularInstallment;
          
          return (
            <button
              key={condition.installments}
              onClick={() => onSelectInstallment?.(condition.installments, condition.totalAmount)}
              className={`
                w-full p-5 rounded-lg border-2 transition-all duration-200 text-left
                hover:border-primary hover:bg-accent/50 hover:shadow-md
                ${isSelected 
                  ? 'border-primary bg-accent shadow-sm' 
                  : 'border-border bg-card'
                }
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">
                      {condition.installments}x de {formatCents(condition.installmentAmount)}
                    </span>
                    {isPopular && (
                      <Badge variant="secondary" className="text-xs">
                        Mais Escolhido
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Total: {formatCents(condition.totalAmount)}
                  </p>
                  {condition.totalAmount > amountCents && (
                    <p className="text-xs text-muted-foreground mt-1">
                      + {formatCents(condition.totalAmount - amountCents)} em juros
                    </p>
                  )}
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
