import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { SplitModal } from '@/components/SplitModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [charge, setCharge] = useState<any>(null);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);

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

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 10000)
        );

        const fetchPromise = fetch(
          `https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/public-payment-link?id=${id}`
        );

        const response = await Promise.race([
          fetchPromise,
          timeoutPromise
        ]) as Response;

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch payment link');
        }

        const data = await response.json();

        if (!data?.charge) {
          toast({
            title: "Link inválido",
            description: "Este link de pagamento não existe ou expirou.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        setCharge(data.charge);
        
        // Abrir modal de split imediatamente
        setIsSplitModalOpen(true);

      } catch (error: any) {
        console.error('Error fetching charge:', error);
        toast({
          title: "Erro ao carregar",
          description: error.message === 'Timeout' 
            ? "A solicitação demorou muito tempo. Tente novamente."
            : "Não foi possível carregar os dados do pagamento.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCharge();
  }, [id, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-ink-secondary">Carregando dados do pagamento...</p>
        </div>
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
      <SplitModal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
        totalCents={charge.amount}
        chargeId={id || ''}
      />
    </div>
  );
}
