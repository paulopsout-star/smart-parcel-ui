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
import { 
  CreditCard, 
  Smartphone, 
  FileText, 
  QrCode,
  Calculator,
  CheckCircle 
} from 'lucide-react';

interface SplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalCents: number;
  chargeId: string;
}

interface PaymentSplit {
  method: 'PIX' | 'CARD' | 'QUITA' | 'BOLETO';
  amountCents: number;
  percentage: number;
}

const paymentMethods = [
  { id: 'PIX' as const, name: 'PIX', icon: QrCode, color: 'bg-primary' },
  { id: 'CARD' as const, name: 'Cartão', icon: CreditCard, color: 'bg-blue-500' },
  { id: 'QUITA' as const, name: 'Quita+', icon: Smartphone, color: 'bg-purple-500' },
  { id: 'BOLETO' as const, name: 'Boleto', icon: FileText, color: 'bg-orange-500' }
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

  useEffect(() => {
    if (totalCents > 0) {
      setSplits([{ method: 'PIX', amountCents: totalCents, percentage: 100 }]);
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
    if (splits.length < 4) {
      setSplits([...splits, { method: 'CARD', amountCents: 0, percentage: 0 }]);
    }
  };

  const removeSplit = (index: number) => {
    if (splits.length > 1) {
      setSplits(splits.filter((_, i) => i !== index));
    }
  };

  const validateSplits = (): { valid: boolean; error?: string } => {
    const totalAmount = splits.reduce((sum, split) => sum + split.amountCents, 0);
    const totalPercentage = splits.reduce((sum, split) => sum + split.percentage, 0);
    
    // Allow ±1 cent tolerance
    if (Math.abs(totalAmount - totalCents) > 1) {
      return { 
        valid: false, 
        error: `Soma dos valores (${formatCurrency(totalAmount)}) deve igual ao total (${formatCurrency(totalCents)})` 
      };
    }
    
    // Check for empty splits
    if (splits.some(split => split.amountCents <= 0)) {
      return { valid: false, error: 'Todos os splits devem ter valor maior que zero' };
    }
    
    // Check for duplicate methods
    const methods = splits.map(s => s.method);
    if (new Set(methods).size !== methods.length) {
      return { valid: false, error: 'Métodos de pagamento não podem ser duplicados' };
    }
    
    return { valid: true };
  };

  const handleConfirm = async () => {
    const validation = validateSplits();
    
    if (!validation.valid) {
      toast({
        title: "Erro na validação",
        description: validation.error,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      // Mock processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate mock checkout URL
      const mockUrl = generateMockCheckoutUrl(chargeId);
      
      // Store splits and URL
      setPaymentSplits(splits);
      setCheckoutUrl(mockUrl);
      
      toast({
        title: "Split processado!",
        description: `${splits.length} método(s) de pagamento configurados com sucesso.`
      });
      
      onClose();
      
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao processar split de pagamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const totalSplitAmount = splits.reduce((sum, split) => sum + split.amountCents, 0);
  const totalSplitPercentage = splits.reduce((sum, split) => sum + split.percentage, 0);
  const validation = validateSplits();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Divisão de Pagamento
          </DialogTitle>
        </DialogHeader>

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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-ink-secondary">Valor (R$)</Label>
                      <Input
                        type="number"
                        min="0"
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
                </div>
              </Card>
            ))}
          </div>

          {splits.length < 4 && (
            <Button
              variant="outline"
              onClick={addSplit}
              className="w-full"
            >
              + Adicionar Método de Pagamento
            </Button>
          )}

          {/* Summary */}
          <Card className="p-4 bg-surface">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-ink-secondary">Total dos splits:</span>
                <span className={`font-semibold ${
                  Math.abs(totalSplitAmount - totalCents) <= 1 
                    ? 'text-success' 
                    : 'text-destructive'
                }`}>
                  {formatCurrency(totalSplitAmount)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-ink-secondary">Percentual total:</span>
                <span className={`${
                  Math.abs(totalSplitPercentage - 100) < 0.1 
                    ? 'text-success' 
                    : 'text-destructive'
                }`}>
                  {totalSplitPercentage.toFixed(1)}%
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
              onClick={handleConfirm}
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={!validation.valid || loading}
            >
              {loading ? 'Processando...' : 'Confirmar Split'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};