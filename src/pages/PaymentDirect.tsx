import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { PaymentForm } from '@/components/PaymentForm';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function PaymentDirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [charge, setCharge] = useState<any>(null);

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
          .eq('payment_link_id', charge.id)
          .eq('method', 'CARD');
      } catch (error) {
        console.error('Error updating payment split:', error);
      }
    }

    // Redirecionar para página de sucesso
    setTimeout(() => {
      navigate(`/thank-you?transaction=${transactionId}`);
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <PaymentForm
          amount={charge.amount_cents / 100}
          installments={1}
          productName={charge.description || `Cobrança - ${charge.payer_name || 'Cliente'}`}
          onSuccess={handlePaymentSuccess}
          skipSplitCheck={true}
        />
      </div>
    </div>
  );
}
