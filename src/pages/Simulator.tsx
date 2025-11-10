import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PaymentSimulator } from '@/components/PaymentSimulator';
import { formatCents, toCents } from '@/lib/currency-utils';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Simulator() {
  const [inputValue, setInputValue] = useState('100,00');
  const [amountCents, setAmountCents] = useState(10000);
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Home
          </Link>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Simulador de Parcelamento</CardTitle>
              <CardDescription>
                Teste o componente PaymentSimulator com valores fictícios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="amount">Valor para Simulação</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                      R$
                    </span>
                    <Input
                      id="amount"
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
            </CardContent>
          </Card>

          <PaymentSimulator
            amountCents={amountCents}
            onSelectInstallment={handleSelectInstallment}
            selectedInstallments={selectedInstallments}
          />
        </div>
      </div>
    </div>
  );
}
