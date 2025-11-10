import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PaymentSimulator } from '@/components/PaymentSimulator';
import { formatCents, toCents } from '@/lib/currency-utils';
import { Calculator } from 'lucide-react';

interface SimulatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAmount?: number; // em centavos
}

export function SimulatorModal({ open, onOpenChange, initialAmount }: SimulatorModalProps) {
  const [inputValue, setInputValue] = useState(
    initialAmount ? formatCents(initialAmount).replace('R$', '').trim() : '100,00'
  );
  const [amountCents, setAmountCents] = useState(initialAmount || 10000);
  const [selectedInstallments, setSelectedInstallments] = useState<number | undefined>();
  const [selectedTotal, setSelectedTotal] = useState<number | undefined>();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setInputValue('');
      return;
    }
    const cents = parseInt(raw);
    const formatted = (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    setInputValue(formatted);
  };

  const handleApplyValue = () => {
    const cents = toCents(inputValue);
    setAmountCents(cents);
    setSelectedInstallments(undefined);
    setSelectedTotal(undefined);
  };

  const handleSelectInstallment = (installments: number, totalAmount: number) => {
    setSelectedInstallments(installments);
    setSelectedTotal(totalAmount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulador de Parcelamento
          </DialogTitle>
          <DialogDescription>
            Simule as condições de parcelamento para diferentes valores
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="modal-amount">Valor para Simulação</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  R$
                </span>
                <Input
                  id="modal-amount"
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="0,00"
                  className="pl-12 text-right font-medium text-lg"
                />
              </div>
            </div>
            <Button onClick={handleApplyValue} size="lg" className="px-8">
              Simular
            </Button>
          </div>

          {selectedInstallments && selectedTotal && (
            <div className="p-4 bg-accent rounded-lg border">
              <h3 className="font-semibold text-sm mb-2">Parcela Selecionada:</h3>
              <p className="text-sm text-muted-foreground">
                {selectedInstallments}x - Total: {formatCents(selectedTotal)}
              </p>
            </div>
          )}

          <PaymentSimulator
            amountCents={amountCents}
            onSelectInstallment={handleSelectInstallment}
            selectedInstallments={selectedInstallments}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
