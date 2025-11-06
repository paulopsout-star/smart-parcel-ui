import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentForm } from '@/components/PaymentForm';
import { useToast } from '@/hooks/use-toast';

export default function PaymentCard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [charge, setCharge] = useState<any>(null);
  const [cardAmount, setCardAmount] = useState(0);
  const [selectedOption, setSelectedOption] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      const { data: splitData, error } = await supabase
        .from('payment_splits')
        .select('*')
        .eq('payment_link_id', id)
        .order('order_index');

      if (error || !splitData || splitData.length === 0) {
        toast({
          title: 'Erro',
          description: 'Link de pagamento inválido ou expirado.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      // Buscar payment_link separadamente
      const { data: paymentLink, error: linkError } = await supabase
        .from('payment_links')
        .select('*')
        .eq('id', id)
        .single();

      if (linkError || !paymentLink) {
        toast({
          title: 'Erro',
          description: 'Dados do pagamento não encontrados.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      const cardSplit = splitData.find((s: any) => s.method === 'credit_card');

      if (!cardSplit) {
        toast({
          title: 'Erro',
          description: 'Pagamento via cartão não encontrado.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setCharge({ ...paymentLink, payment_splits: splitData });
      setCardAmount(cardSplit.amount_cents);
      
      // Usar dados SALVOS do split - ir direto para o formulário
      setSelectedOption({
        id: 'saved',
        totalCents: cardSplit.amount_cents,
        installments: cardSplit.installments || 1,
        installmentValueCents: Math.floor(cardSplit.amount_cents / (cardSplit.installments || 1))
      });
      
      setLoading(false);
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

  // Ir direto para o formulário com os dados salvos
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
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
