import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { SplitModal } from '@/components/SplitModal';
import { CombinedCheckoutSummary } from '@/components/CombinedCheckoutSummary';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentSplit {
  id: string;
  method: string;
  status: string;
  amount_cents: number;
  installments?: number;
}

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [charge, setCharge] = useState<any>(null);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [existingSplits, setExistingSplits] = useState<PaymentSplit[]>([]);
  
  const mode = searchParams.get('mode') || 'direct';

  useEffect(() => {
    const fetchChargeAndSplits = async () => {
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

        // Buscar dados do pagamento E splits existentes em paralelo
        const [paymentResponse, splitsResponse] = await Promise.all([
          fetch(`https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/public-payment-link?id=${id}`),
          fetch(`https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/public-payment-splits?id=${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          })
        ]);

        if (!paymentResponse.ok) {
          const errorData = await paymentResponse.json();
          throw new Error(errorData.message || 'Failed to fetch payment link');
        }

        const data = await paymentResponse.json();
        let splits: PaymentSplit[] = [];

        if (splitsResponse.ok) {
          const splitsData = await splitsResponse.json();
          splits = splitsData.payment_splits || [];
          console.log('[Checkout] Splits existentes:', splits);
        }

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
        setExistingSplits(splits);
        
        // Verificar o método de pagamento
        const paymentMethod = data.payment_method;
        
        // Se for PIX puro, redirecionar para checkout PIX
        if (paymentMethod === 'pix' || paymentMethod === 'PIX') {
          navigate(`/checkout-pix/${data.charge_id || id}`, { replace: true });
          return;
        }
        
        // Se for pagamento combinado (cartão + PIX), verificar splits existentes
        if (paymentMethod === 'cartao_pix') {
          const pixSplit = splits.find(s => s.method === 'pix');
          const cardSplit = splits.find(s => s.method === 'credit_card');
          
          console.log('[Checkout] Estado dos splits:', {
            pixSplit: pixSplit ? { status: pixSplit.status, amount: pixSplit.amount_cents } : null,
            cardSplit: cardSplit ? { status: cardSplit.status, amount: cardSplit.amount_cents } : null
          });

          // CENÁRIO 1: PIX já pago, cartão pendente → ir direto para cartão
          if (pixSplit?.status === 'concluded' && cardSplit?.status === 'pending') {
            console.log('[Checkout] PIX já pago, redirecionando para cartão');
            navigate(`/payment-card/${id}`, { replace: true });
            return;
          }

          // CENÁRIO 2: PIX pendente, cartão pendente (split já definido) → ir para PIX
          if (pixSplit?.status === 'pending' && cardSplit?.status === 'pending') {
            console.log('[Checkout] Splits existentes pendentes, redirecionando para PIX');
            navigate(`/payment-pix/${id}?next=card`, { replace: true });
            return;
          }

          // CENÁRIO 3: Ambos concluídos → ir para thank-you
          if (pixSplit?.status === 'concluded' && cardSplit?.status === 'concluded') {
            console.log('[Checkout] Ambos pagamentos concluídos');
            navigate(`/thank-you?pl=${id}`, { replace: true });
            return;
          }

          // CENÁRIO 4: Só cartão existe e está pendente → ir para cartão
          if (!pixSplit && cardSplit?.status === 'pending') {
            console.log('[Checkout] Só cartão pendente, redirecionando para cartão');
            navigate(`/payment-card/${id}`, { replace: true });
            return;
          }

          // CENÁRIO 5: Nenhum split existe → exibir CombinedCheckoutSummary
          console.log('[Checkout] Nenhum split existente, exibindo formulário de divisão');
          setLoading(false);
          return;
        }
        
        // Se for cartão puro, redirecionar para payment-direct
        if (mode === 'direct') {
          navigate(`/payment-direct/${id}`, { replace: true });
          return;
        }
        
        if (mode === 'split') {
          setIsSplitModalOpen(true);
        }

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

    fetchChargeAndSplits();
  }, [id, toast, navigate, mode]);

  // Handler para confirmação do checkout combinado
  // cardTotalCents = valor TOTAL com juros, installmentValueCents = valor de cada parcela
  const handleCombinedConfirm = async (
    pixTotalCents: number, 
    cardTotalCents: number, 
    cardInstallments: number,
    installmentValueCents: number
  ) => {
    if (!charge) return;

    try {
      // Salvar splits no banco de dados
      const chargeId = charge.charge_id || charge.id;
      
      // Primeiro, deletar splits existentes (se houver)
      await supabase
        .from('payment_splits')
        .delete()
        .eq('charge_id', chargeId);

      // Criar novos splits
      const splits = [];
      
      if (pixTotalCents > 0) {
        splits.push({
          charge_id: chargeId,
          payment_link_id: charge.id,
          method: 'pix',
          amount_cents: pixTotalCents,
          order_index: 1,
          status: 'pending',
        });
      }
      
      if (cardTotalCents > 0) {
        splits.push({
          charge_id: chargeId,
          payment_link_id: charge.id,
          method: 'credit_card',
          amount_cents: cardTotalCents, // Valor TOTAL com juros
          installments: cardInstallments,
          order_index: pixTotalCents > 0 ? 2 : 1,
          status: 'pending',
        });
      }

      if (splits.length > 0) {
        const { error: insertError } = await supabase
          .from('payment_splits')
          .insert(splits);

        if (insertError) {
          console.error('[Checkout] Error inserting splits:', insertError);
          throw new Error('Falha ao salvar configuração de pagamento');
        }
      }

      console.log('[Checkout] ✅ Splits salvos com sucesso:', {
        pixTotalCents,
        cardTotalCents,
        cardInstallments,
        installmentValueCents
      });

      // Redirecionar para o primeiro método de pagamento
      if (pixTotalCents > 0) {
        // Se há PIX, ir para tela de PIX primeiro
        navigate(`/payment-pix/${id}?next=card`);
      } else if (cardTotalCents > 0) {
        // Se só há cartão, ir direto para cartão
        navigate(`/payment-card/${id}`);
      }

    } catch (error: any) {
      console.error('[Checkout] Error in handleCombinedConfirm:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao processar configuração de pagamento.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ds-bg-body flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-ds-text-muted">Carregando dados do pagamento...</p>
        </div>
      </div>
    );
  }

  if (!charge) {
    return (
      <div className="min-h-screen bg-ds-bg-body flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="text-destructive mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-ds-text-strong mb-2">Link Inválido</h2>
          <p className="text-ds-text-muted">
            Este link de pagamento não existe ou expirou.
          </p>
        </Card>
      </div>
    );
  }

  // Renderizar checkout combinado para cartao_pix
  if (charge.payment_method === 'cartao_pix') {
    return (
      <CombinedCheckoutSummary
        totalOriginalCents={charge.amount_cents}
        initialPixCents={charge.pix_amount || 0}
        initialCardCents={charge.card_amount || 0}
        chargeId={charge.charge_id || charge.id}
        paymentLinkId={charge.id || id || ''}
        title={charge.title || charge.description || 'Pagamento'}
        onConfirm={handleCombinedConfirm}
      />
    );
  }

  return (
    <div className="min-h-screen bg-ds-bg-body flex items-center justify-center p-4">
      <SplitModal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
        totalCents={charge.amount_cents}
        chargeId={charge.charge_id || ''}
        paymentLinkId={charge.id || id || ''}
      />
    </div>
  );
}
