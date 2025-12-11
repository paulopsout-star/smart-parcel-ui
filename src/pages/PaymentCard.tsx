import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentForm } from '@/components/PaymentForm';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import { usePaymentSimulation } from '@/hooks/usePaymentSimulation';

export default function PaymentCard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [charge, setCharge] = useState<any>(null);
  const [cardAmount, setCardAmount] = useState(0); // Valor ORIGINAL em centavos
  const [cardInstallments, setCardInstallments] = useState(1);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [pixPaid, setPixPaid] = useState(false);
  const [pixAmount, setPixAmount] = useState(0);
  
  // Buscar simulação para calcular valor com juros (para exibição)
  const { data: simulation } = usePaymentSimulation(cardAmount > 0 ? cardAmount : null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
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

        if (cardSplit.pre_payment_key) {
          console.log('[PaymentCard] Verificando status do pré-pagamento na API Cappta...');
          
          try {
            const { data: statusData } = await supabase.functions.invoke('quitaplus-prepayment-status', {
              body: { prePaymentKey: cardSplit.pre_payment_key }
            });

            console.log('[PaymentCard] Status da API:', statusData);

            if (statusData?.success && statusData?.status === 'LINKED') {
              console.log('[PaymentCard] ✅ Pagamento já LINKED na API, redirecionando para comprovante...');
              navigate(`/thank-you?pl=${id}`, { replace: true });
              return;
            }

            if (statusData?.success && statusData?.status === 'AUTHORIZED') {
              console.log('[PaymentCard] ⚠️ Cartão AUTHORIZED mas não LINKED - redirecionar para thank-you');
              navigate(`/thank-you?pl=${id}`, { replace: true });
              return;
            }
          } catch (statusError) {
            console.error('[PaymentCard] Erro ao verificar status na API:', statusError);
          }
        }

        const isCardPaid = 
          cardSplit.status === 'concluded' || 
          cardSplit.transaction_id;
        
        if (isCardPaid) {
          console.log('[PaymentCard] ✅ Cartão já foi pago (indicadores locais), redirecionando...');
          navigate(`/thank-you?pl=${id}`, { replace: true });
          return;
        }

        if (pixSplit) {
          setPixPaid(pixSplit.status === 'concluded');
          setPixAmount(pixSplit.amount_cents);
        }

        setCharge({ ...paymentLink, payment_splits: splitData });
        
        // ✅ CORREÇÃO CRÍTICA: Evitar double-simulation
        // Para splits antigos (display_amount_cents = NULL), amount_cents JÁ CONTÉM o valor com juros
        // Não devemos simular novamente!
        const cardAmountCents = cardSplit.amount_cents;
        const cardDisplayCents = cardSplit.display_amount_cents;
        const installments = cardSplit.installments || 1;
        
        // Se display_amount_cents existe, usá-lo para exibição e amount_cents para API
        // Se display_amount_cents é NULL, amount_cents É o valor final (já tem juros) - NÃO SIMULAR
        const displayAmountToUse = cardDisplayCents ?? cardAmountCents;
        const originalAmountForApi = cardDisplayCents ? cardAmountCents : cardAmountCents; // Para splits antigos, enviar o mesmo valor
        
        const installmentValue = Math.ceil(displayAmountToUse / installments);
        
        setCardAmount(originalAmountForApi);
        setCardInstallments(installments);
        
        // Salvar o valor final para exibição (evita re-simulação)
        setSelectedOption({
          id: 'saved',
          totalCents: originalAmountForApi,       // Valor para enviar à API
          displayCents: displayAmountToUse,       // Valor FINAL para exibição (já calculado)
          installments: installments,
          installmentValueCents: installmentValue
        });
        
        console.log('[PaymentCard] ✅ Dados carregados:', {
          cardAmountCents,
          cardDisplayCents,
          displayAmountToUse,
          originalAmountForApi,
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
    try {
      console.log('[PaymentCard] Finalizando pagamento via edge function...');
      
      const { data, error } = await supabase.functions.invoke('conclude-card-payment', {
        body: {
          payment_link_id: charge.id,
          amount_cents: cardAmount,
          installments: cardInstallments,
          transaction_id: transactionId
        }
      });
      
      if (error) {
        console.error('[PaymentCard] Erro ao concluir pagamento:', error);
        toast({
          title: 'Atenção',
          description: 'Pagamento aprovado, mas houve erro ao registrar. Entre em contato com o suporte.',
          variant: 'destructive'
        });
      } else {
        console.log('[PaymentCard] ✅ Pagamento concluído com sucesso:', data);
      }
      
      navigate(`/thank-you?pl=${id}`);
      
    } catch (err) {
      console.error('[PaymentCard] Erro inesperado:', err);
      navigate(`/thank-you?pl=${id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 rounded-2xl">
          <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
          <Skeleton className="h-8 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto mb-6" />
          <Skeleton className="h-24 w-full mb-6 rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-6 lg:p-8 rounded-2xl shadow-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950/30 mb-4">
            <CreditCard className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Pagamento via Cartão</h1>
          <p className="text-sm text-muted-foreground">
            Complete o pagamento com seu cartão de crédito
          </p>
        </div>

        {/* PIX Confirmed */}
        {pixPaid && pixAmount > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 flex-shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
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

        {/* Amount Summary */}
        {(() => {
          // ✅ CORREÇÃO: Usar SEMPRE o displayCents salvo - NÃO re-simular
          // displayCents já contém o valor final (com juros) calculado no checkout
          const displayAmountCents = selectedOption?.displayCents || cardAmount;
          const installmentValueCents = Math.ceil(displayAmountCents / cardInstallments);
          
          return (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl p-4 mb-6 text-center border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Valor a pagar no cartão</p>
              <p className="text-3xl font-bold text-blue-600">{formatCurrency(displayAmountCents)}</p>
              {cardInstallments > 1 && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  {cardInstallments}x de {formatCurrency(installmentValueCents)}
                </p>
              )}
            </div>
          );
        })()}

        {/* Payment Form - ENVIA valor ORIGINAL para API, exibe valor COM JUROS */}
        {/* ✅ CORREÇÃO: Usar displayCents salvo - NÃO re-simular */}
        <PaymentForm
          amount={cardAmount / 100}           // Valor para API
          amountDisplay={(selectedOption?.displayCents || cardAmount) / 100} // Valor FINAL com juros
          installments={cardInstallments}
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