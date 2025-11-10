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
              <div className="space-y-2">
                <Label htmlFor="amount">Valor para Simulação (R$)</Label>
                <div className="flex gap-2">
                  <Input
                    id="amount"
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="100,00"
                    className="flex-1"
                  />
                  <Button onClick={handleApplyValue}>
                    Simular
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Valor em centavos: {amountCents} centavos
                </p>
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
