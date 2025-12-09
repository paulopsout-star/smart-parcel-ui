import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentForm } from '@/components/PaymentForm';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { CreditCard, CheckCircle2 } from 'lucide-react';

export default function PaymentCard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [charge, setCharge] = useState<any>(null);
  const [cardAmount, setCardAmount] = useState(0);
  const [cardInstallments, setCardInstallments] = useState(1);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [pixPaid, setPixPaid] = useState(false);
  const [pixAmount, setPixAmount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        // Usar Edge Function pública para buscar dados
        const { data, error } = await supabase.functions.invoke('public-payment-splits', {
          body: { id },
        });

        if (error || !data) {
          console.error('[PaymentCard] Error fetching payment data:', error);
          toast({
            title: 'Erro',
            description: 'Link de pagamento inválido ou expirado.',
            variant: 'destructive',
          });
          navigate('/');
          return;
        }

        const { payment_link: paymentLink, payment_splits: splitData } = data;

        if (!paymentLink || !splitData || splitData.length === 0) {
          toast({
            title: 'Erro',
            description: 'Dados do pagamento não encontrados.',
            variant: 'destructive',
          });
          navigate('/');
          return;
        }

        const cardSplit = splitData.find((s: any) => s.method === 'credit_card');
        const pixSplit = splitData.find((s: any) => s.method === 'pix');

        if (!cardSplit) {
          toast({
            title: 'Erro',
            description: 'Pagamento via cartão não encontrado.',
            variant: 'destructive',
          });
          navigate('/');
          return;
        }

        // Verificar se PIX foi pago (se houver)
        if (pixSplit) {
          setPixPaid(pixSplit.status === 'concluded');
          setPixAmount(pixSplit.amount_cents);
        }

        setCharge({ ...paymentLink, payment_splits: splitData });
        
        // O amount_cents já inclui os juros (foi salvo no CombinedCheckoutSummary)
        const cardTotalWithInterest = cardSplit.amount_cents;
        const installments = cardSplit.installments || 1;
        const installmentValue = Math.ceil(cardTotalWithInterest / installments);
        
        setCardAmount(cardTotalWithInterest);
        setCardInstallments(installments);
        
        // Usar dados SALVOS do split - valor já inclui juros
        setSelectedOption({
          id: 'saved',
          totalCents: cardTotalWithInterest, // Valor total COM juros
          installments: installments,
          installmentValueCents: installmentValue
        });
        
        console.log('[PaymentCard] ✅ Dados carregados:', {
          cardTotalWithInterest,
          installments,
          installmentValue
        });
        
        setLoading(false);
      } catch (err) {
        console.error('[PaymentCard] Unexpected error:', err);
        toast({
          title: 'Erro',
          description: 'Falha ao carregar dados do pagamento.',
          variant: 'destructive',
        });
        navigate('/');
      }
    };

    fetchData();
  }, [id, navigate, toast]);

  const handlePaymentSuccess = async (transactionId: string) => {
    // Atualizar split do cartão como pago
    const cardSplit = charge.payment_splits?.find((s: any) => s.method === 'credit_card');
    if (cardSplit) {
      await supabase
        .from('payment_splits')
        .update({ 
          status: 'concluded',
          transaction_id: transactionId,
          processed_at: new Date().toISOString()
        })
        .eq('id', cardSplit.id);
    }
    
    navigate(`/thank-you?pl=${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Skeleton className="h-96 w-full max-w-6xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950/30 mb-4">
            <CreditCard className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">Pagamento via Cartão</h1>
          <p className="text-ink-secondary">
            Complete o pagamento com seu cartão de crédito
          </p>
        </div>

        {/* PIX já pago (se aplicável) */}
        {pixPaid && pixAmount > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-emerald-800 dark:text-emerald-200">
                  PIX confirmado: {formatCurrency(pixAmount)}
                </p>
                <p className="text-emerald-600 dark:text-emerald-300">
                  Agora complete o pagamento de {formatCurrency(cardAmount)} no cartão.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Resumo do valor */}
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 mb-6 text-center border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Valor a pagar no cartão</p>
          <p className="text-3xl font-bold text-blue-600">{formatCurrency(cardAmount)}</p>
          {cardInstallments > 1 && selectedOption && (
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              {cardInstallments}x de {formatCurrency(selectedOption.installmentValueCents)}
            </p>
          )}
        </div>

        {/* Formulário de Pagamento */}
        <PaymentForm
          amount={selectedOption.totalCents / 100}
          installments={selectedOption.installments}
          productName={charge?.description || 'Pagamento'}
          onSuccess={handlePaymentSuccess}
          chargeId={charge?.charge_id || charge?.id || ''}
          paymentLinkId={id || ''}
          hasBoleto={charge?.has_boleto_link || false}
          boletoLinhaDigitavel={charge?.boleto_linha_digitavel || ''}
          creditorDocument={charge?.creditor_document || ''}
          creditorName={charge?.creditor_name || ''}
        />
      </Card>
    </div>
  );
}
