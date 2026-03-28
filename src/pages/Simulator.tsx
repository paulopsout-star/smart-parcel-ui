import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { PaymentSimulator } from '@/components/PaymentSimulator';
import { formatCents, toCents } from '@/lib/currency-utils';
import { calculateSplitSummary } from '@/lib/checkout-utils';
import { InstallmentCondition } from '@/hooks/usePaymentSimulation';
import { ArrowLeft, Copy, Check, QrCode, CreditCard, Calculator } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

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
          className="pl-10 text-right font-medium text-base"
        />
      </div>
    </div>
  );
}

export default function Simulator() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('total');
  const [copied, setCopied] = useState(false);

  // Modo Total
  const [totalInput, setTotalInput] = useState('2.000,00');
  const [pixPct, setPixPct] = useState(50); // 0–100

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
  const activeTotalCents = mode === 'total' ? totalCents : pixCentsSplit + cardCentsSplit;

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

  const handleCopySummary = useCallback(() => {
    if (!selectedCondition) return;
    const lines = [
      '💳 Simulação de Pagamento',
      '',
      activePixCents > 0 ? `PIX: ${formatCents(activePixCents)} (sem juros)` : null,
      activeCardCents > 0
        ? `Cartão: ${selectedCondition.installments}x de ${formatCents(selectedCondition.installmentAmount)} = ${formatCents(selectedCondition.totalAmount)}`
        : null,
      summary.cardFee > 0 ? `Juros cartão: ${formatCents(summary.cardFee)} (${summary.feePercentage.toFixed(1)}%)` : null,
      '',
      `Total a pagar: ${formatCents(summary.grandTotal)}`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      toast({ title: 'Resumo copiado!', description: 'Cole no WhatsApp ou onde preferir.' });
      setTimeout(() => setCopied(false), 2000);
    });
  }, [selectedCondition, activePixCents, activeCardCents, summary, toast]);

  const hasBothMethods = activePixCents > 0 && activeCardCents > 0;
  const cardSimulationCents = activeCardCents > 0 ? activeCardCents : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Home
          </Link>
        </div>

        <div className="space-y-6">
          {/* ── Cabeçalho ── */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calculator className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Simulador de Pagamento</h1>
              <p className="text-sm text-muted-foreground">
                Simule combinações de PIX e Cartão e veja o custo real com juros
              </p>
            </div>
          </div>

          {/* ── Seletor de modo ── */}
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

          {/* ── Entradas ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {mode === 'total' ? 'Valor total e distribuição' : 'Valores independentes'}
              </CardTitle>
              <CardDescription>
                {mode === 'total'
                  ? 'Defina o valor total e arraste o slider para dividir entre PIX e Cartão'
                  : 'Informe livremente quanto será pago via PIX e quanto via Cartão'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {mode === 'total' ? (
                <>
                  <CurrencyInput
                    id="total"
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

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-semibold">{formatCents(totalCents)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <CurrencyInput
                      id="pix-split"
                      label="Valor PIX"
                      value={pixInput}
                      onChange={handlePixSplit}
                    />
                    <CurrencyInput
                      id="card-split"
                      label="Valor Cartão"
                      value={cardInput}
                      onChange={handleCardSplit}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                    <span className="text-muted-foreground">Total estimado (sem juros):</span>
                    <span className="font-semibold">{formatCents(activeTotalCents)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Simulação do Cartão ── */}
          {cardSimulationCents && cardSimulationCents > 0 && (
            <PaymentSimulator
              amountCents={cardSimulationCents}
              onSelectInstallment={handleSelectInstallment}
              selectedInstallments={selectedCondition?.installments}
              title="Parcelamento do Cartão"
              subtitle={`Parcele os ${formatCents(cardSimulationCents)} do cartão — escolha a melhor opção`}
            />
          )}

          {/* ── Resumo combinado ── */}
          {selectedCondition && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Resumo do Pagamento</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopySummary}
                    className="h-8 gap-1.5"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
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

                {hasBothMethods && summary.cardFee > 0 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    Os juros representam{' '}
                    <span className="font-medium text-foreground">
                      {((summary.cardFee / summary.grandTotal) * 100).toFixed(1)}%
                    </span>{' '}
                    do total geral
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
