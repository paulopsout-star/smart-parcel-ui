import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QrCode, CreditCard, CheckCircle2, Shield, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { usePaymentSimulation } from '@/hooks/usePaymentSimulation';
import { Skeleton } from '@/components/ui/skeleton';

const PIX_FEE_PERCENT = 0.03; // 3%
const MIN_INSTALLMENT_CENTS = 1000; // R$ 10,00 mínimo por parcela

interface CombinedCheckoutSummaryProps {
  totalOriginalCents: number;
  initialPixCents: number;
  initialCardCents: number;
  chargeId: string;
  paymentLinkId: string;
  title: string;
  // IMPORTANTE: cardTotalCents é o valor TOTAL COM JUROS
  onConfirm: (pixTotalCents: number, cardTotalCents: number, cardInstallments: number, installmentValueCents: number) => void;
}

export function CombinedCheckoutSummary({
  totalOriginalCents,
  initialPixCents,
  initialCardCents,
  chargeId,
  paymentLinkId,
  title,
  onConfirm,
}: CombinedCheckoutSummaryProps) {
  // Valores fixos definidos pelo operador (não editáveis pelo cliente)
  const pixBaseCents = initialPixCents;
  const cardCents = initialCardCents;
  const [cardInstallments, setCardInstallments] = useState(1);

  // Simulação de parcelas com juros via API Quita+
  const { data: simulationData, isLoading: isSimulating } = usePaymentSimulation(
    cardCents > 0 ? cardCents : null
  );

  // Condições de parcelamento da API
  const installmentConditions = useMemo(() => {
    if (!simulationData?.simulation?.conditions) return [];
    return simulationData.simulation.conditions;
  }, [simulationData]);

  // Encontrar a condição selecionada
  const selectedCondition = useMemo(() => {
    return installmentConditions.find(c => c.installments === cardInstallments) || null;
  }, [installmentConditions, cardInstallments]);

  // Valor total do cartão COM JUROS
  const cardTotalWithInterest = useMemo(() => {
    if (selectedCondition) {
      return selectedCondition.totalAmount;
    }
    // Fallback: valor sem juros se não tiver simulação
    return cardCents;
  }, [selectedCondition, cardCents]);

  // Calcular taxa PIX
  const pixFeeCents = useMemo(() => Math.round(pixBaseCents * PIX_FEE_PERCENT), [pixBaseCents]);
  const pixTotalCents = useMemo(() => pixBaseCents + pixFeeCents, [pixBaseCents, pixFeeCents]);

  // Calcular total com taxa e juros
  const totalWithFeeCents = useMemo(() => pixTotalCents + cardTotalWithInterest, [pixTotalCents, cardTotalWithInterest]);

  // Calcular máximo de parcelas baseado nas condições da API ou fallback
  const maxInstallments = useMemo(() => {
    if (installmentConditions.length > 0) {
      return Math.max(...installmentConditions.map(c => c.installments));
    }
    if (cardCents <= 0) return 1;
    const max = Math.floor(cardCents / MIN_INSTALLMENT_CENTS);
    return Math.min(Math.max(max, 1), 12);
  }, [cardCents, installmentConditions]);

  // Ajustar parcelas se exceder o máximo
  useEffect(() => {
    if (cardInstallments > maxInstallments) {
      setCardInstallments(Math.max(1, maxInstallments));
    }
  }, [maxInstallments, cardInstallments]);

  return (
    <div className="min-h-screen bg-ds-bg-body flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ds-text-strong mb-2">Resumo do Pagamento</h1>
          <p className="text-ds-text-muted">{title}</p>
        </div>

        {/* Valor Total Original */}
        <div className="bg-ds-bg-surface rounded-lg p-4 mb-6 text-center border border-ds-border">
          <p className="text-sm text-ds-text-muted mb-1">Valor Total da Cobrança</p>
          <p className="text-3xl font-bold text-ds-text-strong">{formatCurrency(totalOriginalCents)}</p>
        </div>

        {/* Cards de Valores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Card PIX */}
          {pixBaseCents > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <QrCode className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-emerald-800 dark:text-emerald-200">Pagamento via PIX</h3>
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <span className="font-medium text-emerald-800 dark:text-emerald-200">Total PIX</span>
                <span className="font-bold text-emerald-600 text-xl">{formatCurrency(pixTotalCents)}</span>
              </div>
            </div>
          )}

          {/* Card Cartão */}
          {cardCents > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-800 dark:text-blue-200">Pagamento via Cartão</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-blue-700 dark:text-blue-300">Parcelas</Label>
                  {isSimulating ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={cardInstallments.toString()}
                      onValueChange={(v) => setCardInstallments(parseInt(v))}
                    >
                      <SelectTrigger className="bg-white dark:bg-ds-bg-surface border-blue-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {installmentConditions.length > 0 ? (
                          installmentConditions.map((condition) => (
                            <SelectItem key={condition.installments} value={condition.installments.toString()}>
                              {condition.installments}x de {formatCurrency(condition.installmentAmount)}
                              {condition.installments === 1 ? ' (à vista)' : ` (Total: ${formatCurrency(condition.totalAmount)})`}
                            </SelectItem>
                          ))
                        ) : (
                          Array.from({ length: maxInstallments }, (_, i) => i + 1).map((i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i}x de {formatCurrency(Math.ceil(cardCents / i))}
                              {i === 1 ? ' (à vista)' : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                <div className="border-t border-blue-200 dark:border-blue-700 pt-2 flex justify-between">
                  <span className="font-medium text-blue-800 dark:text-blue-200">Total Cartão</span>
                  <span className="font-bold text-blue-600 text-lg">
                    {formatCurrency(cardTotalWithInterest)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resumo Final */}
        <div className="bg-ds-bg-surface border border-ds-border rounded-lg p-4 mb-6">
          <div className="space-y-2">
            {pixBaseCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-ds-text-muted">PIX</span>
                <span className="text-ds-text-strong">{formatCurrency(pixTotalCents)}</span>
              </div>
            )}
            {cardCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-ds-text-muted">
                  Cartão ({cardInstallments}x de {formatCurrency(selectedCondition?.installmentAmount || Math.ceil(cardCents / cardInstallments))})
                </span>
                <span className="text-ds-text-strong">{formatCurrency(cardTotalWithInterest)}</span>
              </div>
            )}
            <div className="border-t border-ds-border pt-2 flex justify-between">
              <span className="font-semibold text-ds-text-strong">Total a Pagar</span>
              <span className="font-bold text-primary text-xl">{formatCurrency(totalWithFeeCents)}</span>
            </div>
          </div>
        </div>

        {/* Hierarquia de Pagamento */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">Ordem de Pagamento:</p>
              <ol className="list-decimal list-inside space-y-1">
                {pixBaseCents > 0 && <li>Primeiro: Pagar <strong>{formatCurrency(pixTotalCents)}</strong> via PIX</li>}
                {cardCents > 0 && <li>{pixBaseCents > 0 ? 'Depois' : 'Primeiro'}: Pagar <strong>{formatCurrency(cardTotalWithInterest)}</strong> via Cartão ({cardInstallments}x)</li>}
              </ol>
            </div>
          </div>
        </div>

        {/* Botão Confirmar */}
        <Button
          onClick={() => onConfirm(
            pixTotalCents, 
            cardTotalWithInterest, // Valor TOTAL com juros
            cardInstallments,
            selectedCondition?.installmentAmount || Math.ceil(cardTotalWithInterest / cardInstallments)
          )}
          disabled={(pixBaseCents === 0 && cardCents === 0) || isSimulating}
          className="w-full"
          size="lg"
        >
          {isSimulating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Calculando parcelas...
            </>
          ) : pixBaseCents > 0 ? (
            <>
              <QrCode className="mr-2 h-5 w-5" />
              Continuar para PIX
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-5 w-5" />
              Continuar para Cartão
            </>
          )}
        </Button>

        {/* Segurança */}
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-ds-text-muted">
          <Shield className="w-4 h-4" />
          <span>Pagamento 100% seguro</span>
        </div>
      </Card>
    </div>
  );
}
