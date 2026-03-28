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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { PaymentSimulator } from '@/components/PaymentSimulator';
import { formatCents, toCents } from '@/lib/currency-utils';
import { calculateSplitSummary } from '@/lib/checkout-utils';
import { InstallmentCondition } from '@/hooks/usePaymentSimulation';
import { Calculator, QrCode, CreditCard } from 'lucide-react';

type Mode = 'total' | 'split';

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
  const [mode, setMode] = useState<Mode>('total');

  // Modo Total
  const [totalInput, setTotalInput] = useState(
    initialAmount
      ? (initialAmount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '2.000,00'
  );
  const [pixPct, setPixPct] = useState(50);

  // Modo Separado
  const [pixInput, setPixInput] = useState('1.000,00');
  const [cardInput, setCardInput] = useState('1.000,00');

  // Parcela selecionada
  const [selectedCondition, setSelectedCondition] = useState<InstallmentCondition | null>(null);

  // --- Valores derivados ---
  const totalCents = toCents(totalInput);
  const cardCentsFromTotal = Math.round(totalCents * (1 - pixPct / 100));
  const pixCentsFromTotal = totalCents - cardCentsFromTotal;

  const pixCentsSplit = toCents(pixInput);
  const cardCentsSplit = toCents(cardInput);

  const activePixCents = mode === 'total' ? pixCentsFromTotal : pixCentsSplit;
  const activeCardCents = mode === 'total' ? cardCentsFromTotal : cardCentsSplit;

  const summary = calculateSplitSummary(activePixCents, selectedCondition);

  // --- Handlers ---
  const handleModeChange = useCallback((v: string) => {
    setMode(v as Mode);
    setSelectedCondition(null);
  }, []);

  const handleTotalChange = useCallback((v: string) => {
    setTotalInput(v);
    setSelectedCondition(null);
  }, []);

  const handleSlider = useCallback((vals: number[]) => {
    setPixPct(vals[0]);
    setSelectedCondition(null);
  }, []);

  const handlePixSplit = useCallback((v: string) => {
    setPixInput(v);
    setSelectedCondition(null);
  }, []);

  const handleCardSplit = useCallback((v: string) => {
    setCardInput(v);
    setSelectedCondition(null);
  }, []);

  const handleSelectInstallment = useCallback(
    (_installments: number, _totalAmount: number, condition?: InstallmentCondition) => {
      setSelectedCondition(condition ?? null);
    },
    []
  );

  const cardSimulationCents = activeCardCents > 0 ? activeCardCents : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulador de Pagamento
          </DialogTitle>
          <DialogDescription>
            Simule combinações de PIX e Cartão e veja o custo real com juros
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Seletor de modo */}
          <Tabs value={mode} onValueChange={handleModeChange}>
            <TabsList className="w-full">
              <TabsTrigger value="total" className="flex-1">
                Valor Total com Divisão
              </TabsTrigger>
              <TabsTrigger value="split" className="flex-1">
                Valores Separados
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Entradas */}
          {mode === 'total' ? (
            <div className="space-y-4">
              <CurrencyInput
                id="modal-total"
                label="Valor Total da Cobrança"
                value={totalInput}
                onChange={handleTotalChange}
              />

              <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium">
                  <span className="flex items-center gap-1.5 text-blue-600">
                    <QrCode className="h-4 w-4" />
                    PIX: {formatCents(pixCentsFromTotal)}
                  </span>
                  <span className="flex items-center gap-1.5 text-violet-600">
                    <CreditCard className="h-4 w-4" />
                    Cartão: {formatCents(cardCentsFromTotal)}
                  </span>
                </div>
                <Slider
                  value={[pixPct]}
                  onValueChange={handleSlider}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>100% PIX</span>
                  <span>{pixPct}% PIX / {100 - pixPct}% Cartão</span>
                  <span>100% Cartão</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <CurrencyInput
                  id="modal-pix"
                  label="Valor PIX"
                  value={pixInput}
                  onChange={handlePixSplit}
                />
                <CurrencyInput
                  id="modal-card"
                  label="Valor Cartão"
                  value={cardInput}
                  onChange={handleCardSplit}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                <span className="text-muted-foreground">Total estimado (sem juros):</span>
                <span className="font-semibold">{formatCents(pixCentsSplit + cardCentsSplit)}</span>
              </div>
            </div>
          )}

          {/* Simulação do Cartão */}
          {cardSimulationCents && cardSimulationCents > 0 && (
            <PaymentSimulator
              amountCents={cardSimulationCents}
              onSelectInstallment={handleSelectInstallment}
              selectedInstallments={selectedCondition?.installments}
              title="Parcelamento do Cartão"
              subtitle={`Parcele os ${formatCents(cardSimulationCents)} do cartão — escolha a melhor opção`}
            />
          )}

          {/* Resumo combinado */}
          {selectedCondition && (
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
              <h3 className="font-semibold text-sm">Resumo do Pagamento</h3>

              {activePixCents > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <QrCode className="h-4 w-4 text-blue-500" />
                    <span>PIX</span>
                    <span className="text-xs text-green-600 font-medium">sem juros</span>
                  </div>
                  <span className="font-semibold">{formatCents(activePixCents)}</span>
                </div>
              )}

              {activeCardCents > 0 && (
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

              {summary.cardFee > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground pl-6">
                    Juros ({summary.feePercentage.toFixed(1)}% sobre cartão)
                  </span>
                  <span className="text-red-500">+{formatCents(summary.cardFee)}</span>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <span className="font-semibold">Total a pagar</span>
                <span className="text-lg font-bold text-primary">
                  {formatCents(summary.grandTotal)}
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
