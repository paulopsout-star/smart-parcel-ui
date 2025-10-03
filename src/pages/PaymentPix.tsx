import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { QrCode, Copy, CheckCircle2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

export default function PaymentPix() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [charge, setCharge] = useState<any>(null);
  const [pixAmount, setPixAmount] = useState(0);
  
  const nextStep = searchParams.get('next'); // 'card' se houver cartão depois

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
      
      // Buscar valor do PIX nos splits
      const pixSplit = chargeData.payment_splits?.find((s: any) => s.method === 'pix' && s.order_index === 1);
      setPixAmount(pixSplit?.amount_cents || chargeData.amount);
      
      setLoading(false);
    };

    fetchData();
  }, [id, navigate, toast]);

  const handleCopyPixCode = () => {
    // Mock: código PIX simulado
    const mockPixCode = `00020126580014br.gov.bcb.pix0136${crypto.randomUUID()}520400005303986540${(pixAmount / 100).toFixed(2)}5802BR5925AUTONEGOCIE6009SAO PAULO62070503***6304`;
    
    navigator.clipboard.writeText(mockPixCode);
    toast({
      title: 'Copiado!',
      description: 'Código PIX copiado para a área de transferência.',
    });
  };

  const handleConfirmPayment = async () => {
    setPaying(true);
    
    // Mock: simular pagamento de PIX (2 segundos)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Atualizar split do PIX como pago
    const pixSplit = charge.payment_splits?.find((s: any) => s.method === 'pix');
    if (pixSplit) {
      await supabase
        .from('payment_splits')
        .update({ 
          status: 'concluded', 
          pix_paid_at: new Date().toISOString(),
          processed_at: new Date().toISOString()
        })
        .eq('id', pixSplit.id);
    }
    
    toast({
      title: 'PIX confirmado!',
      description: 'Pagamento via PIX realizado com sucesso.',
    });
    
    // Redirecionar para cartão (se houver) ou thank-you
    const hasCardPayment = charge.payment_splits?.some((s: any) => s.method === 'credit_card');
    if (nextStep === 'card' || hasCardPayment) {
      navigate(`/payment-card/${id}`);
    } else {
      navigate('/thank-you');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8">
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-12 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <QrCode className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-ink mb-2">Pagamento via PIX</h1>
          <p className="text-ink-secondary">
            Escaneie o QR Code ou copie o código PIX abaixo
          </p>
        </div>

        {/* Valor */}
        <div className="bg-primary/5 rounded-lg p-6 mb-6 text-center">
          <p className="text-sm text-ink-secondary mb-2">Valor a pagar via PIX</p>
          <p className="text-4xl font-bold text-primary">{formatCurrency(pixAmount)}</p>
        </div>

        {/* QR Code Mock */}
        <div className="bg-white p-8 rounded-lg mb-6 flex items-center justify-center border-2 border-dashed border-gray-300">
          <div className="text-center">
            <QrCode className="w-48 h-48 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-ink-muted">QR Code simulado</p>
          </div>
        </div>

        {/* Botão Copiar */}
        <Button
          onClick={handleCopyPixCode}
          variant="outline"
          className="w-full mb-6"
        >
          <Copy className="mr-2" />
          Copiar código PIX
        </Button>

        {/* Instruções */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Instruções:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Abra o app do seu banco</li>
                <li>Escolha pagar via PIX</li>
                <li>Escaneie o QR Code ou cole o código copiado</li>
                <li>Confirme o pagamento</li>
                <li>Clique em "Confirmar Pagamento" abaixo</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Botão Confirmar */}
        <Button
          onClick={handleConfirmPayment}
          disabled={paying}
          className="w-full"
          size="lg"
        >
          {paying ? (
            <>
              <Clock className="mr-2 animate-spin" />
              Confirmando pagamento...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2" />
              Confirmar Pagamento
            </>
          )}
        </Button>

        {/* Info adicional */}
        {nextStep === 'card' && (
          <div className="mt-6 text-center text-sm text-ink-muted">
            Após confirmar o PIX, você será direcionado para o pagamento do valor restante no cartão.
          </div>
        )}
      </Card>
    </div>
  );
}
