import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Loader2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  totalAmount: number;
  recurrenceType: string;
  payerName?: string;
  isValid: boolean;
  validationErrors: string[];
  onSubmit: () => void;
  isLoading: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  totalAmount,
  recurrenceType,
  payerName,
  isValid,
  validationErrors,
  onSubmit,
  isLoading
}) => {
  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const recurrenceLabels: Record<string, string> = {
    pontual: 'Pontual',
    diaria: 'Diária',
    semanal: 'Semanal',
    quinzenal: 'Quinzenal',
    mensal: 'Mensal',
    semestral: 'Semestral',
    anual: 'Anual'
  };

  return (
    <div className="sticky top-6 space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader className="border-b border-border bg-surface-light">
          <CardTitle className="text-lg font-semibold text-ink">
            Resumo da Cobrança
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4 pt-6">
          {/* Valor Total */}
          <div className="space-y-1">
            <p className="text-sm text-ink-secondary">Valor Total</p>
            <p className="text-3xl font-bold text-brand">
              {formatCurrency(totalAmount)}
            </p>
          </div>

          {/* Tipo */}
          <div className="flex items-center justify-between py-3 border-t border-border">
            <span className="text-sm text-ink-secondary">Tipo</span>
            <Badge variant="outline" className="bg-brand/10 text-brand border-brand">
              {recurrenceLabels[recurrenceType] || 'Pontual'}
            </Badge>
          </div>

          {/* Pagador (se preenchido) */}
          {payerName && (
            <div className="flex items-center justify-between py-3 border-t border-border">
              <span className="text-sm text-ink-secondary">Pagador</span>
              <span className="text-sm font-medium text-ink truncate max-w-[150px]" title={payerName}>
                {payerName}
              </span>
            </div>
          )}

          {/* Botão Submit */}
          <Button
            type="submit"
            disabled={!isValid || isLoading}
            className={cn(
              'w-full h-12 text-base font-semibold transition-all duration-200',
              isValid && !isLoading
                ? 'bg-brand hover:bg-brand-dark text-white shadow-md hover:shadow-lg'
                : 'bg-ink-muted text-ink-secondary cursor-not-allowed opacity-60'
            )}
            onClick={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Criar Cobrança
              </>
            )}
          </Button>

          {/* Lista de erros (se houver) */}
          {validationErrors.length > 0 && !isLoading && (
            <div className="pt-4 border-t border-border">
              <p className="text-xs font-medium text-ink-secondary mb-2">
                Corrija os seguintes itens:
              </p>
              <ul className="space-y-1.5">
                {validationErrors.slice(0, 5).map((error, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <AlertCircle className="w-3 h-3 text-feedback-error mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-feedback-error leading-tight">{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badge SSL */}
      <div className="flex items-center justify-center gap-2 text-xs text-ink-muted">
        <Shield className="w-4 h-4" />
        <span>Conexão segura SSL 256-bit</span>
      </div>
    </div>
  );
};
