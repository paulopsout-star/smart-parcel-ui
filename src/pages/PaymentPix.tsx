import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { QrCode, Copy, CheckCircle2, Clock, CreditCard, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

export default function PaymentPix() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [generatingPix, setGeneratingPix] = useState(false);
  const [paying, setPaying] = useState(false);
  const [charge, setCharge] = useState<any>(null);
  const [pixAmount, setPixAmount] = useState(0);
  const [hasCardPayment, setHasCardPayment] = useState(false);
  const [cardAmount, setCardAmount] = useState(0);
  
  const [pixData, setPixData] = useState<{
    brCode: string;
    brCodeBase64: string;
    pixId: string;
    expiresAt: string;
  } | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  
  const nextStep = searchParams.get('next');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        const { data, error } = await supabase.functions.invoke('public-payment-splits', {
          body: { id },
        });

        if (error || !data) {
          console.error('[PaymentPix] Error fetching payment data:', error);
          toast({
            title: 'Erro',
            description: 'Link de pagamento inválido ou expirado.',
            variant: 'destructive',
          });
          navigate('/');
          return;
        }

        const { payment_link: paymentLink, payment_splits: splitData, charge: chargeData } = data;

        if (!paymentLink || !splitData || splitData.length === 0) {
          toast({
            title: 'Erro',
            description: 'Dados do pagamento não encontrados.',
            variant: 'destructive',
          });
          navigate('/');
          return;
        }

        const pixSplit = splitData.find((s: any) => s.method === 'pix');
        const cardSplit = splitData.find((s: any) => s.method === 'credit_card');
        
        const chargeInfo = { 
          ...paymentLink, 
          payment_splits: splitData,
          payer_document: chargeData?.payer_document || paymentLink.payer_document,
          payer_phone: chargeData?.payer_phone || paymentLink.payer_phone_number,
          payer_email: chargeData?.payer_email || paymentLink.payer_email,
          payer_name: chargeData?.payer_name || paymentLink.payer_name,
          charge_id: paymentLink.charge_id
        };
        
        setCharge(chargeInfo);
        setPixAmount(pixSplit?.amount_cents || 0);
        setHasCardPayment(!!cardSplit);
        setCardAmount(cardSplit?.amount_cents || 0);
        
        setLoading(false);
        
        if (pixSplit?.amount_cents > 0) {
          generatePixQrCode(chargeInfo, pixSplit.amount_cents);
        }
      } catch (err) {
        console.error('[PaymentPix] Unexpected error:', err);
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

  const generatePixQrCode = async (chargeInfo: any, amountCents: number) => {
    setGeneratingPix(true);
    setPixError(null);
    
    try {
      console.log('[PaymentPix] Gerando QR Code PIX via AbacatePay...');

      const { data, error } = await supabase.functions.invoke('abacatepay-pix-create', {
        body: {
          chargeId: chargeInfo.charge_id,
          amountCents: amountCents,
          payerEmail: chargeInfo.payer_email,
          payerName: chargeInfo.payer_name,
          payerPhone: chargeInfo.payer_phone,
          payerDocument: chargeInfo.payer_document,
          description: `Pagamento PIX - ${chargeInfo.payer_name}`
        }
      });

      if (error) {
        console.error('[PaymentPix] Erro ao gerar QR Code:', error);
        setPixError('Falha ao gerar QR Code. Tente novamente.');
        return;
      }

      if (data?.alreadyPaid) {
        console.log('[PaymentPix] ✅ PIX já foi pago! Confirmando e redirecionando...');
        toast({
          title: 'PIX já pago!',
          description: 'Detectamos que o pagamento PIX já foi realizado.',
        });
        
        const pixSplit = chargeInfo.payment_splits?.find((s: any) => s.method === 'pix');
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
        
        const cardSplit = chargeInfo.payment_splits?.find((s: any) => s.method === 'credit_card');
        if (cardSplit && cardSplit.amount_cents > 0) {
          navigate(`/payment-card/${id}`);
        } else {
          navigate(`/thank-you?pl=${id}`);
        }
        return;
      }

      if (data?.reused) {
        toast({
          title: 'QR Code recuperado',
          description: 'Exibindo seu QR Code PIX válido.',
        });
      }

      if (!data?.success || !data?.brCode || !data?.brCodeBase64) {
        setPixError(data?.error || 'Erro ao gerar QR Code PIX.');
        return;
      }

      setPixData({
        brCode: data.brCode,
        brCodeBase64: data.brCodeBase64,
        pixId: data.pixId,
        expiresAt: data.expiresAt
      });
    } catch (err) {
      console.error('[PaymentPix] Erro inesperado:', err);
      setPixError('Erro inesperado ao gerar QR Code.');
    } finally {
      setGeneratingPix(false);
    }
  };

  const handleCopyPixCode = () => {
    if (!pixData?.brCode) {
      toast({
        title: 'Erro',
        description: 'QR Code ainda não foi gerado.',
        variant: 'destructive',
      });
      return;
    }
    
    navigator.clipboard.writeText(pixData.brCode);
    toast({
      title: 'Copiado!',
      description: 'Código PIX copiado para a área de transferência.',
    });
  };

  const handleRegenerateQrCode = () => {
    if (charge && pixAmount > 0) {
      generatePixQrCode(charge, pixAmount);
    }
  };

  const handleConfirmPayment = async () => {
    setPaying(true);
    
    try {
      const { data: statusData } = await supabase.functions.invoke('abacatepay-check-status', {
        body: { chargeId: charge.charge_id }
      });
      
      console.log('[PaymentPix] Status do pagamento:', statusData);
      
      if (statusData?.status === 'COMPLETED' || statusData?.status === 'PAID') {
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
        
        const cardSplit = charge?.payment_splits?.find((s: any) => s.method === 'credit_card');
        if (cardSplit && cardSplit.amount_cents > 0) {
          navigate(`/payment-card/${id}`);
        } else {
          navigate(`/thank-you?pl=${id}`);
        }
        return;
      }
      
      toast({
        title: 'Aguardando pagamento',
        description: 'O pagamento ainda não foi identificado. Verifique se o PIX foi realizado.',
        variant: 'destructive',
      });
    } catch (err) {
      console.error('[PaymentPix] Erro ao verificar pagamento:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível verificar o status do pagamento.',
        variant: 'destructive',
      });
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 rounded-2xl">
          <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
          <Skeleton className="h-8 w-3/4 mx-auto mb-4" />
          <Skeleton className="h-64 w-full mb-4 rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-6 lg:p-8 rounded-2xl shadow-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <QrCode className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Pagamento via PIX</h1>
          <p className="text-sm text-muted-foreground">
            Escaneie o QR Code ou copie o código PIX abaixo
          </p>
        </div>

        {/* Amount */}
        <div className="bg-primary/5 rounded-2xl p-5 mb-6 text-center border border-primary/10">
          <p className="text-sm text-muted-foreground mb-1">Valor a pagar via PIX</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(pixAmount)}</p>
        </div>

        {/* Next Payment Info */}
        {hasCardPayment && cardAmount > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200">
                  Próximo passo: Pagamento via Cartão
                </p>
                <p className="text-blue-600 dark:text-blue-300">
                  Após confirmar o PIX, você pagará <strong>{formatCurrency(cardAmount)}</strong> no cartão.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* QR Code */}
        <div className="bg-card p-6 rounded-2xl mb-6 flex items-center justify-center border border-border">
          {generatingPix ? (
            <div className="text-center py-8">
              <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Gerando QR Code PIX...</p>
            </div>
          ) : pixError ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive mb-4">{pixError}</p>
              <Button 
                variant="outline" 
                onClick={handleRegenerateQrCode}
                className="gap-2 rounded-full"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </Button>
            </div>
          ) : pixData?.brCodeBase64 ? (
            <div className="text-center">
              <img 
                src={pixData.brCodeBase64.startsWith('data:') 
                  ? pixData.brCodeBase64 
                  : `data:image/png;base64,${pixData.brCodeBase64}`}
                alt="QR Code PIX"
                className="w-64 h-64 mx-auto"
              />
              {pixData.expiresAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Expira em: {new Date(pixData.expiresAt).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <QrCode className="w-24 h-24 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Aguardando geração do QR Code...</p>
            </div>
          )}
        </div>

        {/* Copy Button */}
        <Button
          onClick={handleCopyPixCode}
          variant="outline"
          className="w-full mb-6 rounded-full h-11"
          disabled={!pixData?.brCode || generatingPix}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copiar código PIX
        </Button>

        {/* Instructions */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
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

        {/* Confirm Button */}
        <Button
          onClick={handleConfirmPayment}
          disabled={paying || !pixData?.pixId || generatingPix}
          className="w-full h-11 rounded-full text-sm font-semibold"
          size="lg"
        >
          {paying ? (
            <>
              <Clock className="mr-2 h-4 w-4 animate-spin" />
              Verificando pagamento...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar Pagamento PIX
            </>
          )}
        </Button>

        {/* Regenerate Button */}
        {pixData && !generatingPix && (
          <Button
            onClick={handleRegenerateQrCode}
            variant="ghost"
            className="w-full mt-3 text-muted-foreground"
          >
            <RefreshCw className="mr-2 w-4 h-4" />
            Gerar novo QR Code
          </Button>
        )}

        {/* Additional Info */}
        {hasCardPayment && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Após confirmar o PIX, você será direcionado para o pagamento do valor restante no cartão.
          </div>
        )}
      </Card>
    </div>
  );
}