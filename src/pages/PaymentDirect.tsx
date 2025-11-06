import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PaymentForm } from '@/components/PaymentForm';
import { CheckoutOptionCard } from '@/components/CheckoutOptionCard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { calculatePaymentOptions } from '@/lib/checkout-utils';
import { PaymentOption } from '@/types/payment-options';
import { ArrowLeft } from 'lucide-react';

export default function PaymentDirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [charge, setCharge] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<PaymentOption | null>(null);
  const [customAmount, setCustomAmount] = useState(0);
  const [customInstallments, setCustomInstallments] = useState(1);

  useEffect(() => {
    const fetchCharge = async () => {
      if (!id) {
        toast({
          title: "Erro",
          description: "Link de pagamento inválido.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Buscar dados do link de pagamento via edge function
        const response = await fetch(
          `https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/public-payment-link?id=${id}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch payment link');
        }

        const data = await response.json();

        if (!data?.amount_cents) {
          toast({
            title: "Link inválido",
            description: "Este link de pagamento não existe ou expirou.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        setCharge(data);
      } catch (error: any) {
        console.error('Error fetching charge:', error);
        toast({
          title: "Erro ao carregar",
          description: "Não foi possível carregar os dados do pagamento.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCharge();
  }, [id, toast]);

  const handlePaymentSuccess = async (transactionId: string) => {
    toast({
      title: "Pagamento processado!",
      description: "Seu pagamento foi processado com sucesso.",
    });

    // Atualizar status do payment_split no banco (se existir)
    if (charge?.id) {
      try {
        await supabase
          .from('payment_splits')
          .update({ 
            status: 'concluded',
            transaction_id: transactionId,
            processed_at: new Date().toISOString()
          })
          .eq('payment_link_id', charge.id);
      } catch (error) {
        console.error('Error updating payment split:', error);
      }
    }

    // Redirecionar para página de comprovante com o token correto (payment link id)
    setTimeout(() => {
      navigate(`/thank-you?pl=${id}`);
    }, 1500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-24 w-full mb-4" />
          <Skeleton className="h-24 w-full mb-4" />
          <Skeleton className="h-12 w-full" />
        </Card>
      </div>
    );
  }

  if (!charge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="text-destructive mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">Link Inválido</h2>
          <p className="text-ink-secondary">
            Este link de pagamento não existe ou expirou.
          </p>
        </Card>
      </div>
    );
  }

  // Calcular opções de pagamento
  const paymentOptions = calculatePaymentOptions(charge.amount_cents);

  // Calcular valor e parcelas finais baseado na seleção
  const finalAmount = selectedOption 
    ? (selectedOption.isCustom ? customAmount : selectedOption.totalCents)
    : charge.amount_cents;
  const finalInstallments = selectedOption
    ? (selectedOption.isCustom ? customInstallments : selectedOption.installments)
    : 1;

  const handleCustomValueChange = (amountCents: number, installments: number) => {
    setCustomAmount(amountCents);
    setCustomInstallments(installments);
  };

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Escolha a melhor forma de pagamento
          </h1>
          <p className="text-muted-foreground">
            {charge.description || `Pagamento para ${charge.payer_name || 'Cliente'}`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna Esquerda: Opções de Pagamento */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Selecione o valor e as parcelas
            </h2>
            <div className="space-y-4">
              {paymentOptions.map((option) => (
                <CheckoutOptionCard
                  key={option.id}
                  option={option}
                  isSelected={selectedOption?.id === option.id}
                  onSelect={() => setSelectedOption(option)}
                  onCustomValueChange={handleCustomValueChange}
                />
              ))}
            </div>
          </div>

          {/* Coluna Direita: Formulário de Pagamento */}
          <div>
            <PaymentForm
              amount={finalAmount / 100}
              installments={finalInstallments}
              productName={charge.description || `Cobrança - ${charge.payer_name || 'Cliente'}`}
              onSuccess={handlePaymentSuccess}
              skipSplitCheck={true}
              disableSubmit={!selectedOption}
              initialPayerData={{
                name: charge.payer_name || '',
                email: charge.payer_email || '',
                document: charge.payer_document || '',
                phone: charge.payer_phone || '',
              }}
            />
          </div>
        </div>

        {/* Informações de Segurança */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>🔒 Pagamento 100% seguro e criptografado</p>
        </div>
      </div>
    </div>
  );
}
