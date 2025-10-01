import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCheckoutStore } from '@/hooks/useCheckoutStore';
import { generateMockCheckoutUrl } from '@/hooks/useCheckoutMocks';
import { formatCurrency } from '@/lib/utils';
import { PaymentForm } from '@/components/PaymentForm';
import { 
  CreditCard, 
  Smartphone, 
  FileText, 
  QrCode,
  Calculator,
  CheckCircle,
  ArrowLeft
} from 'lucide-react';

interface SplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalCents: number;
  chargeId: string;
}

interface PaymentSplit {
  method: 'PIX' | 'CARD';
  amountCents: number;
  percentage: number;
  installments?: number;
}

const paymentMethods = [
  { id: 'PIX' as const, name: 'PIX', icon: QrCode, color: 'bg-primary' },
  { id: 'CARD' as const, name: 'Cartão', icon: CreditCard, color: 'bg-blue-500' }
];

export const SplitModal: React.FC<SplitModalProps> = ({
  isOpen,
  onClose,
  totalCents,
  chargeId
}) => {
  const { toast } = useToast();
  const { setPaymentSplits, setCheckoutUrl } = useCheckoutStore();
  const [splits, setSplits] = useState<PaymentSplit[]>([
    { method: 'PIX', amountCents: totalCents, percentage: 100 }
  ]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'splits' | 'payment'>('splits');

  useEffect(() => {
    if (totalCents > 0) {
      setSplits([{ method: 'PIX', amountCents: totalCents, percentage: 100, installments: 1 }]);
      setStep('splits');
    }
  }, [totalCents]);

  const updateSplit = (index: number, field: 'amountCents' | 'percentage', value: number) => {
    const newSplits = [...splits];
    
    if (field === 'amountCents') {
      newSplits[index].amountCents = value;
      newSplits[index].percentage = totalCents > 0 ? (value / totalCents) * 100 : 0;
    } else {
      newSplits[index].percentage = value;
      newSplits[index].amountCents = Math.round((value / 100) * totalCents);
    }
    
    setSplits(newSplits);
  };

  const addSplit = () => {
    if (splits.length < 2) {
      const nextMethod = splits.find(s => s.method === 'PIX') ? 'CARD' : 'PIX';
      setSplits([...splits, { method: nextMethod as 'PIX' | 'CARD', amountCents: 0, percentage: 0, installments: 1 }]);
    }
  };

  const removeSplit = (index: number) => {
    if (splits.length > 1) {
      setSplits(splits.filter((_, i) => i !== index));
    }
  };

  const validateSplits = (): { valid: boolean; error?: string } => {
    const totalAmount = splits.reduce((sum, split) => sum + split.amountCents, 0);
    
    // STRICT: Must equal total exactly (0 cents tolerance)
    if (totalAmount !== totalCents) {
      return { 
        valid: false, 
        error: `Soma dos valores (${formatCurrency(totalAmount)}) deve ser exatamente ${formatCurrency(totalCents)}` 
      };
    }
    
    // Check minimum R$ 1,00 per method
    const minCents = 100;
    if (splits.some(split => split.amountCents < minCents)) {
      return { valid: false, error: 'Cada método deve ter no mínimo R$ 1,00' };
    }
    
    // Check card installment minimum R$ 10,00
    const minInstallmentCents = 1000;
    const cardSplit = splits.find(s => s.method === 'CARD');
    if (cardSplit && cardSplit.installments && cardSplit.installments > 1) {
      const installmentValue = Math.floor(cardSplit.amountCents / cardSplit.installments);
      if (installmentValue < minInstallmentCents) {
        return { valid: false, error: 'Parcela do cartão deve ser no mínimo R$ 10,00' };
      }
    }
    
    // Check for duplicate methods
    const methods = splits.map(s => s.method);
    if (new Set(methods).size !== methods.length) {
      return { valid: false, error: 'Métodos de pagamento não podem ser duplicados' };
    }
    
    return { valid: true };
  };

  const handleConfirmSplits = () => {
    const validation = validateSplits();
    
    if (!validation.valid) {
      toast({
        title: "Erro na validação",
        description: validation.error,
        variant: "destructive"
      });
      return;
    }

    // Store splits and move to payment step
    setPaymentSplits(splits);
    setStep('payment');
  };

  const handlePaymentSuccess = async (transactionId: string) => {
    setLoading(true);
    
    try {
      // Mock processing delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Generate mock checkout URL
      const mockUrl = generateMockCheckoutUrl(chargeId);
      setCheckoutUrl(mockUrl);
      
      toast({
        title: "Pagamento processado!",
        description: `Transação ${transactionId} realizada com sucesso.`
      });
      
      onClose();
      
      // Reset to splits step for next time
      setTimeout(() => setStep('splits'), 500);
      
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao processar pagamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('splits');
  };

  const totalSplitAmount = splits.reduce((sum, split) => sum + split.amountCents, 0);
  const validation = validateSplits();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'payment' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="mr-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {step === 'splits' ? (
              <>
                <Calculator className="w-5 h-5" />
                Divisão de Pagamento
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Dados do Pagamento
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'splits' ? (
          <div className="space-y-6">
          <div className="bg-surface p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-ink-secondary">Total a dividir:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(totalCents)}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {splits.map((split, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const method = paymentMethods.find(m => m.id === split.method);
                        const Icon = method?.icon || CreditCard;
                        return (
                          <>
                            <div className={`p-2 rounded-lg ${method?.color || 'bg-gray-500'} text-white`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <select
                              value={split.method}
                              onChange={(e) => {
                                const newSplits = [...splits];
                                newSplits[index].method = e.target.value as any;
                                setSplits(newSplits);
                              }}
                              className="border rounded px-2 py-1 text-sm bg-background text-ink"
                            >
                              {paymentMethods.map(method => (
                                <option key={method.id} value={method.id}>
                                  {method.name}
                                </option>
                              ))}
                            </select>
                          </>
                        );
                      })()}
                    </div>
                    
                    {splits.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeSplit(index)}
                      >
                        Remover
                      </Button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-ink-secondary">Valor (R$)</Label>
                        <Input
                          type="number"
                          min="1"
                          step="0.01"
                          value={(split.amountCents / 100).toFixed(2)}
                          onChange={(e) => {
                            const cents = Math.round(parseFloat(e.target.value || '0') * 100);
                            updateSplit(index, 'amountCents', cents);
                          }}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-ink-secondary">Percentual (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={split.percentage.toFixed(1)}
                          onChange={(e) => {
                            const percentage = parseFloat(e.target.value || '0');
                            updateSplit(index, 'percentage', percentage);
                          }}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    {split.method === 'CARD' && (
                      <div>
                        <Label className="text-sm text-ink-secondary">Parcelas do Cartão</Label>
                        <select
                          value={split.installments || 1}
                          onChange={(e) => {
                            const newSplits = [...splits];
                            newSplits[index].installments = parseInt(e.target.value);
                            setSplits(newSplits);
                          }}
                          className="w-full mt-1 border rounded px-3 py-2 text-sm bg-background text-ink"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => {
                            const installmentValue = Math.floor(split.amountCents / n);
                            const lastInstallment = split.amountCents - (installmentValue * (n - 1));
                            return (
                              <option key={n} value={n}>
                                {n}x de {formatCurrency(installmentValue)}
                                {n > 1 && ` (última: ${formatCurrency(lastInstallment)})`}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {splits.length < 2 && (
            <Button
              variant="outline"
              onClick={addSplit}
              className="w-full"
            >
              + Adicionar Método de Pagamento (PIX ou Cartão)
            </Button>
          )}

          {/* Summary */}
          <Card className="p-4 bg-surface">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-ink-secondary">Total dos splits:</span>
                <span className={`font-semibold ${
                  totalSplitAmount === totalCents 
                    ? 'text-success' 
                    : 'text-destructive'
                }`}>
                  {formatCurrency(totalSplitAmount)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-ink-secondary">Requerido:</span>
                <span className="font-semibold text-primary">
                  {formatCurrency(totalCents)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-ink-secondary">Diferença:</span>
                <span className={`font-semibold ${
                  totalSplitAmount === totalCents 
                    ? 'text-success' 
                    : 'text-destructive'
                }`}>
                  {formatCurrency(Math.abs(totalSplitAmount - totalCents))}
                  {totalSplitAmount !== totalCents && (totalSplitAmount > totalCents ? ' a mais' : ' a menos')}
                </span>
              </div>
              
              {!validation.valid && (
                <div className="text-sm text-destructive mt-2">
                  {validation.error}
                </div>
              )}
              
              {validation.valid && (
                <div className="flex items-center gap-2 text-success text-sm mt-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Divisão validada com sucesso</span>
                </div>
              )}
            </div>
          </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmSplits}
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={!validation.valid || loading}
              >
                Continuar para Pagamento
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <PaymentForm
              amount={totalCents / 100}
              installments={1}
              productName="Pagamento"
              onSuccess={handlePaymentSuccess}
              onCancel={handleBack}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};