import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckoutOptionCard } from '@/components/CheckoutOptionCard';
import { PaymentForm } from '@/components/PaymentForm';
import { useToast } from '@/hooks/use-toast';
import { calculatePaymentOptions } from '@/lib/checkout-utils';
import { formatCurrency } from '@/lib/utils';
import { Shield, CheckCircle } from 'lucide-react';

export default function PaymentCard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [charge, setCharge] = useState<any>(null);
  const [cardAmount, setCardAmount] = useState(0);
  const [options, setOptions] = useState<any[]>([]);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [customAmount, setCustomAmount] = useState(0);
  const [customInstallments, setCustomInstallments] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      const { data: chargeData, error } = await supabase
        .from('charges')
        .select('*, payment_splits(*)')
        .eq('checkout_link_id', id)
        .single();

      if (error || !chargeData) {
        toast({
          title: 'Erro',
          description: 'Link de pagamento inválido ou expirado.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setCharge(chargeData);
      
      // Buscar valor do CARTÃO nos splits (order_index = 2) ou total se for 100% cartão
      const cardSplit = chargeData.payment_splits?.find((s: any) => s.method === 'credit_card');
      const amountToUse = cardSplit?.amount_cents || chargeData.amount;
      setCardAmount(amountToUse);
      
      // Calcular opções de pagamento usando o mesmo utilitário
      const paymentOptions = calculatePaymentOptions(amountToUse);
      setOptions(paymentOptions);
      
      // Auto-selecionar a opção popular (6x)
      const popularOption = paymentOptions.find(opt => opt.type === 'popular');
      if (popularOption) {
        setSelectedOption(popularOption);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [id, navigate, toast]);

  const handleCustomValueChange = (amountCents: number, installments: number) => {
    setCustomAmount(amountCents);
    setCustomInstallments(installments);
    
    const customOption = {
      id: 'custom',
      type: 'custom',
      title: 'Valor Personalizado',
      totalCents: amountCents,
      installments: installments,
      installmentValueCents: Math.floor(amountCents / installments),
      isCustom: true
    };
    
    setSelectedOption(customOption);
  };

  const handleContinueToPayment = () => {
    if (!selectedOption) {
      toast({
        title: 'Atenção',
        description: 'Selecione uma opção de pagamento.',
        variant: 'destructive',
      });
      return;
    }
    
    setShowPaymentForm(true);
  };

  const handlePaymentSuccess = async (transactionId: string) => {
    // Atualizar split do cartão como pago
    const cardSplit = charge.payment_splits?.find((s: any) => s.method === 'credit_card');
    if (cardSplit) {
      await supabase
        .from('payment_splits')
        .update({ 
          status: 'concluded',
          transaction_id: transactionId,
          processed_at: new Date().toISOString(),
          installments: selectedOption?.installments || 1
        })
        .eq('id', cardSplit.id);
    }
    
    navigate('/thank-you');
  };

  const handlePaymentCancel = () => {
    setShowPaymentForm(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Skeleton className="h-96 w-full max-w-6xl" />
      </div>
    );
  }

  if (showPaymentForm && selectedOption) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8">
          <PaymentForm
            amount={selectedOption.totalCents / 100}
            installments={selectedOption.installments}
            productName={charge.description || 'Pagamento'}
            onSuccess={handlePaymentSuccess}
            onCancel={handlePaymentCancel}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-ink mb-2">
              Escolha o parcelamento
            </h1>
            <p className="text-lg text-ink-secondary">
              Selecione como deseja pagar o valor no cartão
            </p>
          </div>

          {/* Layout: Cards à esquerda, Resumo à direita */}
          <div className="grid lg:grid-cols-[1fr,400px] gap-8">
            {/* Coluna Esquerda: Cards de Opções */}
            <div className="space-y-4">
              {options.map((option) => (
                <CheckoutOptionCard
                  key={option.id}
                  option={option}
                  isSelected={selectedOption?.id === option.id}
                  onSelect={() => setSelectedOption(option)}
                  onCustomValueChange={option.isCustom ? handleCustomValueChange : undefined}
                  customAmount={customAmount}
                  customInstallments={customInstallments}
                />
              ))}

              {/* Badge Segurança */}
              <div className="flex items-center justify-center gap-2 text-sm text-ink-muted pt-4">
                <Shield className="w-4 h-4" />
                <span>Pagamento 100% seguro e criptografado</span>
              </div>
            </div>

            {/* Coluna Direita: Resumo */}
            <div className="lg:sticky lg:top-8 h-fit">
              <Card className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-ink mb-2">Resumo do Pagamento</h3>
                    <p className="text-sm text-ink-secondary">{charge.description || 'Pagamento'}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-secondary">Valor no cartão</span>
                      <span className="text-2xl font-bold text-primary">{formatCurrency(cardAmount)}</span>
                    </div>
                  </div>

                  {selectedOption && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-ink-secondary">Parcelas:</span>
                        <span className="font-medium">{selectedOption.installments}x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-secondary">Valor da parcela:</span>
                        <span className="font-medium">{formatCurrency(selectedOption.installmentValueCents)}</span>
                      </div>
                    </div>
                  )}

                  {charge.payment_splits?.some((s: any) => s.method === 'pix' && s.pix_paid_at) && (
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                      <CheckCircle className="w-4 h-4" />
                      <span>PIX já confirmado</span>
                    </div>
                  )}

                  <Button
                    onClick={handleContinueToPayment}
                    disabled={!selectedOption}
                    className="w-full"
                    size="lg"
                  >
                    Continuar para Pagamento
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
