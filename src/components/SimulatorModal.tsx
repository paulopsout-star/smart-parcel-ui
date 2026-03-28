import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PaymentSimulator } from '@/components/PaymentSimulator';
import { formatCents, toCents } from '@/lib/currency-utils';
import { InstallmentCondition } from '@/hooks/usePaymentSimulation';
import { Calculator, QrCode, CreditCard } from 'lucide-react';

const PIX_FEE_PCT = 0.015; // 1,5%

function parseCurrencyInput(value: string): string {
  const raw = value.replace(/\D/g, '');
  if (!raw) return '';
  const cents = parseInt(raw);
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CurrencyInput({
  id,
  label,
  value,
  onChange,
  placeholder = '0,00',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
          R$
        </span>
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(parseCurrencyInput(e.target.value))}
          placeholder={placeholder}
          className="pl-10 text-right font-medium"
        />
      </div>
    </div>
  );
}

interface SimulatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAmount?: number; // em centavos
}

export function SimulatorModal({ open, onOpenChange, initialAmount }: SimulatorModalProps) {
  const [pixInput, setPixInput] = useState('1.000,00');
  const [cardInput, setCardInput] = useState(
    initialAmount
      ? (initialAmount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '1.000,00'
  );
  const [selectedCondition, setSelectedCondition] = useState<InstallmentCondition | null>(null);

  const pixCents = toCents(pixInput);
  const cardCents = toCents(cardInput);

  const pixFee = Math.round(pixCents * PIX_FEE_PCT);
  const pixTotal = pixCents + pixFee;

  const cardTotal = selectedCondition ? selectedCondition.totalAmount : cardCents;
  const grandTotal = pixTotal + cardTotal;

  const handlePixChange = useCallback((v: string) => {
    setPixInput(v);
    setSelectedCondition(null);
  }, []);

  const handleCardChange = useCallback((v: string) => {
    setCardInput(v);
    setSelectedCondition(null);
  }, []);

  const handleSelectInstallment = useCallback(
    (_installments: number, _totalAmount: number, condition?: InstallmentCondition) => {
      setSelectedCondition(condition ?? null);
    },
    []
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulador de Pagamento
          </DialogTitle>
          <DialogDescription>
            Simule combinações de PIX e Cartão e veja o custo real com taxas e juros
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Entradas */}
          <div className="grid grid-cols-2 gap-4">
            <CurrencyInput
              id="modal-pix"
              label="Valor PIX"
              value={pixInput}
              onChange={handlePixChange}
            />
            <CurrencyInput
              id="modal-card"
              label="Valor Cartão"
              value={cardInput}
              onChange={handleCardChange}
            />
          </div>

          {/* Resumo de totais */}
          <div className="space-y-2 p-3 bg-muted rounded-lg text-sm">
            {pixCents > 0 && (
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <QrCode className="h-3.5 w-3.5" />
                  Taxa PIX (1,5%)
                </span>
                <span className="text-red-500">+{formatCents(pixFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total a pagar</span>
              <span>{formatCents(grandTotal)}</span>
            </div>
          </div>

          {/* Simulação do Cartão */}
          {cardCents > 0 && (
            <PaymentSimulator
              amountCents={cardCents}
              onSelectInstallment={handleSelectInstallment}
              selectedInstallments={selectedCondition?.installments}
              title="Parcelamento do Cartão"
              subtitle={`Parcele os ${formatCents(cardCents)} do cartão — escolha a melhor opção`}
            />
          )}

          {/* Resumo detalhado após selecionar parcela */}
          {selectedCondition && (
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
              <h3 className="font-semibold text-sm">Resumo do Pagamento</h3>

              {pixCents > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <QrCode className="h-4 w-4 text-blue-500" />
                      <span>PIX</span>
                    </div>
                    <span className="font-semibold">{formatCents(pixCents)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground pl-6">Taxa PIX (1,5%)</span>
                    <span className="text-red-500">+{formatCents(pixFee)}</span>
                  </div>
                </>
              )}

              {cardCents > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-violet-500" />
                    <span>
                      Cartão {selectedCondition.installments}x de{' '}
                      {formatCents(selectedCondition.installmentAmount)}
                    </span>
                  </div>
                  <span className="font-semibold">{formatCents(selectedCondition.totalAmount)}</span>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <span className="font-semibold">Total a pagar</span>
                <span className="text-lg font-bold text-primary">
                  {formatCents(grandTotal)}
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
