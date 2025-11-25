import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QrCode, Copy, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function CheckoutPix() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [charge, setCharge] = useState<any>(null);
  const [qrCodeData, setQrCodeData] = useState<{
    qrCode: string;
    brCode: string;
  } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('pending');
  const [error, setError] = useState<string>('');

  // Carregar dados da cobrança
  useEffect(() => {
    if (!id) return;

    const loadCharge = async () => {
      try {
        const { data, error } = await supabase
          .from('charges')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        
        if (!data) {
          setError('Cobrança não encontrada');
          return;
        }

        setCharge(data);
      } catch (err) {
        console.error('[CheckoutPix] Erro ao carregar cobrança:', err);
        setError('Erro ao carregar dados da cobrança');
      } finally {
        setLoading(false);
      }
    };

    loadCharge();
  }, [id]);

  // Gerar QR Code PIX
  const handleGenerateQrCode = async () => {
    if (!charge?.checkout_url) {
      toast({
        title: 'Erro',
        description: 'Link de checkout não encontrado',
        className: 'bg-feedback-error-bg border-feedback-error text-feedback-error'
      });
      return;
    }

    setGeneratingQr(true);
    setError('');

    try {
      // Abrir checkout do Abacate Pay em nova aba
      // O Abacate Pay gerencia o fluxo de pagamento PIX
      window.open(charge.checkout_url, '_blank');

      toast({
        title: 'Checkout Aberto',
        description: 'Complete o pagamento na janela aberta',
        className: 'bg-feedback-info-bg border-feedback-info text-feedback-info'
      });

      // Iniciar polling para verificar pagamento
      startPaymentPolling();
    } catch (err) {
      console.error('[CheckoutPix] Erro ao abrir checkout:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível abrir o checkout',
        className: 'bg-feedback-error-bg border-feedback-error text-feedback-error'
      });
    } finally {
      setGeneratingQr(false);
    }
  };

  // Polling para verificar pagamento
  const startPaymentPolling = () => {
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('charges')
          .select('status')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data.status === 'completed') {
          setPaymentStatus('paid');
          clearInterval(pollInterval);
          
          toast({
            title: 'Pagamento Confirmado!',
            description: 'Redirecionando...',
            className: 'bg-feedback-success-bg border-feedback-success text-feedback-success'
          });

          setTimeout(() => {
            navigate('/thank-you');
          }, 2000);
        }
      } catch (err) {
        console.error('[CheckoutPix] Erro no polling:', err);
      }
    }, 5000); // Verificar a cada 5 segundos

    // Limpar polling após 10 minutos
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 600000);
  };

  // Copiar código PIX
  const handleCopyBrCode = () => {
    if (!qrCodeData?.brCode) return;

    navigator.clipboard.writeText(qrCodeData.brCode);
    toast({
      title: 'Copiado!',
      description: 'Código PIX copiado para área de transferência',
      className: 'bg-feedback-success-bg border-feedback-success text-feedback-success'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !charge) {
    return (
      <div className="min-h-screen bg-surface py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Cobrança não encontrada'}
            </AlertDescription>
          </Alert>
          <Button onClick={() => navigate('/')} className="mt-4">
            Voltar ao Início
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-surface py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-6 w-6 text-brand" />
                Pagamento via PIX
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Informações da Cobrança */}
              <div className="space-y-4 p-4 bg-surface-light rounded-lg border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-ink-secondary">Pagador</span>
                  <span className="font-medium text-ink">{charge.payer_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-ink-secondary">Valor</span>
                  <span className="text-2xl font-bold text-brand">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(charge.amount / 100)}
                  </span>
                </div>
                {charge.description && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm text-ink-secondary">{charge.description}</p>
                  </div>
                )}
              </div>

              {/* Status do Pagamento */}
              {paymentStatus === 'paid' ? (
                <Alert className="bg-feedback-success-bg border-feedback-success">
                  <CheckCircle className="h-4 w-4 text-feedback-success" />
                  <AlertDescription className="text-feedback-success">
                    Pagamento confirmado! Redirecionando...
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* Botão para Gerar QR Code */}
                  {!qrCodeData && (
                    <Button
                      onClick={handleGenerateQrCode}
                      disabled={generatingQr}
                      className="w-full"
                      size="lg"
                    >
                      {generatingQr ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Abrindo Checkout...
                        </>
                      ) : (
                        <>
                          <QrCode className="mr-2 h-5 w-5" />
                          Gerar QR Code PIX
                        </>
                      )}
                    </Button>
                  )}

                  {/* QR Code e Código Copia-e-Cola */}
                  {qrCodeData && (
                    <div className="space-y-4">
                      {/* QR Code Image */}
                      <div className="flex justify-center p-6 bg-white rounded-lg border-2 border-border">
                        <img
                          src={qrCodeData.qrCode}
                          alt="QR Code PIX"
                          className="w-64 h-64"
                        />
                      </div>

                      {/* Código Copia-e-Cola */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-ink">
                          Ou copie o código abaixo:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={qrCodeData.brCode}
                            readOnly
                            className="flex-1 px-3 py-2 text-sm font-mono bg-surface border border-border rounded-md"
                          />
                          <Button
                            onClick={handleCopyBrCode}
                            variant="outline"
                            size="icon"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <Alert>
                        <AlertDescription>
                          Após realizar o pagamento, aguarde alguns instantes. A confirmação é automática.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}
