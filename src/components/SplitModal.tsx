import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { CreditCard, QrCode, Trash2, Plus, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CardInstallmentSelector } from '@/components/CardInstallmentSelector';

interface SplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalCents: number;
  chargeId: string;
}

interface PaymentSplit {
  method: 'PIX' | 'CARD';
  amount: number;
  percentage: number;
  installments?: number;
}

const paymentMethods = [
  { value: 'PIX', label: 'PIX', icon: QrCode, color: 'bg-primary' },
  { value: 'CARD', label: 'Cartão de Crédito', icon: CreditCard, color: 'bg-blue-500' }
];

export function SplitModal({ isOpen, onClose, totalCents, chargeId }: SplitModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [splits, setSplits] = useState<PaymentSplit[]>([
    { method: 'PIX', amount: 0, percentage: 0 }
  ]);
  const [loading, setLoading] = useState(false);

  const updateSplit = (index: number, field: 'amount' | 'percentage', value: number) => {
    const newSplits = [...splits];
    
    if (field === 'amount') {
      newSplits[index].amount = value;
      newSplits[index].percentage = totalCents > 0 ? (value / totalCents) * 100 : 0;
    } else {
      newSplits[index].percentage = value;
      newSplits[index].amount = Math.round((value / 100) * totalCents);
    }
    
    setSplits(newSplits);
  };

  const addSplit = () => {
    if (splits.length < 2) {
      const nextMethod = splits.find(s => s.method === 'PIX') ? 'CARD' : 'PIX';
      setSplits([...splits, { method: nextMethod as 'PIX' | 'CARD', amount: 0, percentage: 0, installments: 1 }]);
    }
  };

  const removeSplit = (index: number) => {
    if (splits.length > 1) {
      setSplits(splits.filter((_, i) => i !== index));
    }
  };

  const validateSplits = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const totalAmount = splits.reduce((sum, s) => sum + s.amount, 0);
    
    if (totalAmount !== totalCents) {
      errors.push(`A soma deve ser exatamente ${formatCurrency(totalCents)}`);
    }
    
    if (splits.some(s => s.amount < 100)) {
      errors.push('Cada método deve ter no mínimo R$ 1,00');
    }
    
    const cardSplit = splits.find(s => s.method === 'CARD');
    if (cardSplit && cardSplit.installments && cardSplit.installments > 1) {
      const installmentValue = Math.floor(cardSplit.amount / cardSplit.installments);
      if (installmentValue < 1000) {
        errors.push('Parcela do cartão deve ser no mínimo R$ 10,00');
      }
    }
    
    const methods = splits.map(s => s.method);
    if (new Set(methods).size !== methods.length) {
      errors.push('Métodos não podem ser duplicados');
    }
    
    return { valid: errors.length === 0, errors };
  };

  const handleConfirmSplits = async () => {
    const validation = validateSplits();
    if (!validation.valid) {
      toast({
        title: "Valores inválidos",
        description: validation.errors[0],
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Persistir splits no DB
      const splitsToInsert = splits.map((split) => ({
        charge_id: chargeId,
        method: split.method === 'PIX' ? 'pix' : 'credit_card',
        amount_cents: split.amount,
        order_index: split.method === 'PIX' ? 1 : 2,
        installments: split.installments || 1,
        status: 'pending'
      }));

      const { error } = await supabase
        .from('payment_splits')
        .insert(splitsToInsert);

      if (error) throw error;

      // Redirecionar conforme a escolha
      const hasPix = splits.some(s => s.method === 'PIX');
      const hasCard = splits.some(s => s.method === 'CARD');

      if (hasPix && hasCard) {
        // Split: PIX primeiro
        navigate(`/payment-pix/${chargeId}?next=card`);
      } else if (hasPix) {
        // 100% PIX
        navigate(`/payment-pix/${chargeId}`);
      } else {
        // 100% Cartão
        navigate(`/payment-card/${chargeId}`);
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving splits:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as formas de pagamento.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Como deseja pagar?</DialogTitle>
          <DialogDescription>
            Escolha combinar PIX + Cartão ou pagar tudo em um único meio
          </DialogDescription>
        </DialogHeader>

        {/* Cards de método de pagamento */}
        <div className="space-y-4">
          {splits.map((split, index) => {
            const method = paymentMethods.find(m => m.value === split.method);
            if (!method) return null;

            return (
              <Card key={index} className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${method.color}`}>
                    <method.icon className="w-6 h-6 text-white" />
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">{method.label}</Label>
                      {splits.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSplit(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`amount-${index}`} className="text-sm">
                          Valor (R$)
                        </Label>
                        <Input
                          id={`amount-${index}`}
                          type="number"
                          step="0.01"
                          value={split.amount / 100}
                          onChange={(e) => updateSplit(index, 'amount', parseFloat(e.target.value) * 100)}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor={`percentage-${index}`} className="text-sm">
                          Porcentagem (%)
                        </Label>
                        <Input
                          id={`percentage-${index}`}
                          type="number"
                          step="0.01"
                          value={split.percentage}
                          onChange={(e) => updateSplit(index, 'percentage', parseFloat(e.target.value))}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {split.method === 'CARD' && split.amount > 0 && (
                      <div className="mt-4">
                        <CardInstallmentSelector
                          cardAmountCents={split.amount}
                          selectedInstallments={split.installments || 1}
                          onInstallmentsChange={(installments) => {
                            const newSplits = [...splits];
                            newSplits[index].installments = installments;
                            setSplits(newSplits);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Botão adicionar método */}
        {splits.length < 2 && (
          <Button
            variant="outline"
            onClick={addSplit}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar outro método de pagamento
          </Button>
        )}

        {/* Resumo */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-ink-secondary">Total da cobrança:</span>
            <span className="font-semibold">{formatCurrency(totalCents)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-secondary">Total selecionado:</span>
            <span className={`font-semibold ${
              splits.reduce((sum, s) => sum + s.amount, 0) === totalCents
                ? 'text-green-600'
                : 'text-destructive'
            }`}>
              {formatCurrency(splits.reduce((sum, s) => sum + s.amount, 0))}
            </span>
          </div>
        </div>

        {/* Validações */}
        {(() => {
          const validation = validateSplits();
          if (!validation.valid) {
            return (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-sm text-destructive">
                  {validation.errors.map((error, i) => (
                    <div key={i}>• {error}</div>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Botão confirmar */}
        <Button
          onClick={handleConfirmSplits}
          disabled={loading || !validateSplits().valid}
          className="w-full"
          size="lg"
        >
          {loading ? 'Processando...' : 'Continuar para o Pagamento'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
