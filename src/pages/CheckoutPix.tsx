import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Copy, CheckCircle2, User, Mail, Phone, CreditCard, FileText, QrCode } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface ChargeData {
  id: string;
  payer_name: string;
  payer_email: string;
  payer_phone: string;
  payer_document: string;
  amount: number;
  description: string | null;
  checkout_link_id: string | null;
  status: string;
}

interface PixData {
  brCodeBase64: string;
  brCode: string;
  pixId: string;
  status: string;
  expiresAt: string;
}

export default function CheckoutPix() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [charge, setCharge] = useState<ChargeData | null>(null);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!id) return;
    loadChargeData();
    
    // Cleanup do polling quando sair da página
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        console.log('[CheckoutPix] 🧹 Polling limpo ao desmontar componente');
      }
    };
  }, [id, pollInterval]);

  const loadChargeData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('charges')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Cobrança não encontrada');

      setCharge(data);

      // Se já tem checkout_link_id (billing do Abacate Pay), pode gerar QR Code
      if (data.checkout_link_id) {
        // QR Code será gerado ao clicar no botão
      }
    } catch (err: any) {
      console.error('[CheckoutPix] Erro ao carregar cobrança:', err);
      setError(err.message || 'Erro ao carregar dados da cobrança');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQrCode = async () => {
    if (!charge) {
      toast({
        title: 'Erro',
        description: 'Dados da cobrança não carregados',
        className: 'bg-feedback-error-bg border-feedback-error text-feedback-error'
      });
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      console.log('[CheckoutPix] Gerando PIX via Abacate Pay...');

      const { data, error: pixError } = await supabase.functions.invoke('abacatepay-pix-create', {
        body: {
          chargeId: charge.id,
          amountCents: charge.amount,
          payerEmail: charge.payer_email,
          payerName: charge.payer_name,
          payerPhone: charge.payer_phone,
          payerDocument: charge.payer_document,
          description: charge.description || 'Pagamento Autonegocie'
        }
      });

      if (pixError) throw pixError;
      if (!data?.brCodeBase64 || !data?.brCode) {
        throw new Error('QR Code não retornado pela API');
      }

      setPixData({
        brCodeBase64: data.brCodeBase64,
        brCode: data.brCode,
        pixId: data.pixId,
        status: data.status,
        expiresAt: data.expiresAt
      });
      
      toast({
        title: 'QR Code gerado!',
        description: 'Escaneie o código ou use o copia e cola',
        className: 'bg-feedback-success-bg border-feedback-success text-feedback-success'
      });

      // Iniciar polling para verificar pagamento
      startPaymentPolling();
    } catch (err: any) {
      console.error('[CheckoutPix] Erro ao gerar QR Code:', err);
      setError(err.message || 'Erro ao gerar QR Code PIX');
      toast({
        title: 'Erro ao gerar QR Code',
        description: err.message || 'Tente novamente',
        className: 'bg-feedback-error-bg border-feedback-error text-feedback-error'
      });
    } finally {
      setGenerating(false);
    }
  };

  const startPaymentPolling = () => {
    if (!pixData?.pixId) return;
    
    setPolling(true);
    console.log('[CheckoutPix] 🔄 Iniciando polling de status do PIX:', pixData.pixId);
    
    const interval = setInterval(async () => {
      try {
        console.log('[CheckoutPix] 🔍 Verificando status do PIX...');
        
        const { data, error: statusError } = await supabase.functions.invoke('abacatepay-check-status', {
          body: {
            pixId: pixData.pixId,
            chargeId: charge?.id
          }
        });

        if (statusError) {
          console.error('[CheckoutPix] ❌ Erro ao verificar status:', statusError);
          return;
        }

        console.log('[CheckoutPix] ✅ Status verificado:', data?.status);

        if (data?.status === 'PAID') {
          clearInterval(interval);
          setPollInterval(null);
          setPolling(false);
          
          console.log('[CheckoutPix] 💰 Pagamento confirmado!');
          
          toast({
            title: '✅ Pagamento Confirmado!',
            description: 'Obrigado pelo seu pagamento. Redirecionando...',
            className: 'bg-feedback-success-bg border-feedback-success text-feedback-success'
          });
          
          setTimeout(() => {
            navigate('/thank-you');
          }, 2000);
        }
      } catch (err) {
        console.error('[CheckoutPix] ❌ Erro no polling:', err);
      }
    }, 3000); // Verificar a cada 3 segundos

    setPollInterval(interval);

    // Limpar polling após 30 minutos
    setTimeout(() => {
      clearInterval(interval);
      setPollInterval(null);
      setPolling(false);
      console.log('[CheckoutPix] ⏱️ Polling encerrado por timeout');
    }, 1800000); // 30 minutos
  };

  const handleManualCheck = async () => {
    if (!pixData?.pixId || !charge?.id) {
      toast({
        title: 'Erro',
        description: 'Dados do PIX não disponíveis',
        className: 'bg-feedback-error-bg border-feedback-error text-feedback-error'
      });
      return;
    }

    try {
      setChecking(true);
      console.log('[CheckoutPix] 🔍 Verificação manual iniciada:', pixData.pixId);

      const { data, error: statusError } = await supabase.functions.invoke('abacatepay-check-status', {
        body: {
          pixId: pixData.pixId,
          chargeId: charge.id
        }
      });

      if (statusError) {
        console.error('[CheckoutPix] ❌ Erro ao verificar status:', statusError);
        toast({
          title: 'Erro na verificação',
          description: 'Não foi possível verificar o status. Tente novamente.',
          className: 'bg-feedback-error-bg border-feedback-error text-feedback-error'
        });
        return;
      }

      console.log('[CheckoutPix] ✅ Status verificado manualmente:', data?.status);

      if (data?.status === 'PAID') {
        // Parar polling automático
        if (pollInterval) {
          clearInterval(pollInterval);
          setPollInterval(null);
        }
        setPolling(false);
        
        console.log('[CheckoutPix] 💰 Pagamento confirmado!');
        
        toast({
          title: '✅ Pagamento Confirmado!',
          description: 'Obrigado pelo seu pagamento. Redirecionando...',
          className: 'bg-feedback-success-bg border-feedback-success text-feedback-success'
        });
        
        setTimeout(() => {
          navigate('/thank-you');
        }, 2000);
      } else {
        toast({
          title: 'Pagamento não confirmado',
          description: 'O pagamento ainda não foi identificado. Aguarde alguns segundos e tente novamente.',
          className: 'bg-feedback-warning-bg border-feedback-warning text-feedback-warning'
        });
      }
    } catch (err) {
      console.error('[CheckoutPix] ❌ Erro na verificação manual:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível verificar o pagamento',
        className: 'bg-feedback-error-bg border-feedback-error text-feedback-error'
      });
    } finally {
      setChecking(false);
    }
  };

  const handleCopyBrCode = () => {
    if (!pixData?.brCode) return;
    
    navigator.clipboard.writeText(pixData.brCode);
    toast({
      title: 'Código copiado!',
      description: 'Cole no app do seu banco',
      className: 'bg-feedback-success-bg border-feedback-success text-feedback-success'
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const formatPhone = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) {
      return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
    }
    return phone;
  };

  const formatDocument = (doc: string) => {
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0,3)}.${clean.slice(3,6)}.${clean.slice(6,9)}-${clean.slice(9)}`;
    }
    if (clean.length === 14) {
      return `${clean.slice(0,2)}.${clean.slice(2,5)}.${clean.slice(5,8)}/${clean.slice(8,12)}-${clean.slice(12)}`;
    }
    return doc;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-surface-light/20 to-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !charge) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-surface-light/20 to-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <Alert className="bg-feedback-error-bg border-feedback-error">
            <AlertDescription className="text-feedback-error">
              {error || 'Cobrança não encontrada'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-background via-surface-light/20 to-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <QrCode className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Pagamento via PIX</h1>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20">
              Instantâneo e Seguro
            </Badge>
          </div>

          {/* Informações do Pagador */}
          <Card>
            <CardHeader className="bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados do Pagador
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Nome</p>
                  <p className="text-base font-semibold">{charge.payer_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">CPF/CNPJ</p>
                  <p className="text-base font-semibold">{formatDocument(charge.payer_document)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Email</p>
                  <p className="text-base truncate">{charge.payer_email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Telefone</p>
                  <p className="text-base">{formatPhone(charge.payer_phone)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Valor e Descrição */}
          <Card>
            <CardHeader className="bg-gradient-to-br from-primary/5 to-primary/[0.02] border-b border-primary/10">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Valor da Cobrança
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <p className="text-5xl font-bold text-primary">
                  {formatCurrency(charge.amount)}
                </p>
                {charge.description && (
                  <div className="pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Descrição</p>
                    <p className="text-sm">{charge.description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gerador de QR Code ou QR Code Exibido */}
          {!pixData ? (
            <Card>
              <CardContent className="pt-6">
                <Button
                  onClick={handleGenerateQrCode}
                  disabled={generating}
                  className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Gerando QR Code...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-5 w-5" />
                      Gerar QR Code PIX
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* QR Code Exibido */}
              <Card>
                <CardHeader className="bg-muted/30 text-center">
                  <CardTitle>Escaneie o QR Code</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-6">
                    <div className="bg-white p-4 rounded-lg">
                      <img 
                        src={pixData.brCodeBase64} 
                        alt="QR Code PIX" 
                        className="w-64 h-64"
                      />
                    </div>
                    
                    <div className="w-full space-y-3">
                      <p className="text-sm text-center text-muted-foreground">
                        Ou use o código copia e cola:
                      </p>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-muted/50 p-3 rounded-lg border border-border">
                          <p className="text-xs font-mono break-all">
                            {pixData.brCode}
                          </p>
                        </div>
                        <Button
                          onClick={handleCopyBrCode}
                          variant="outline"
                          size="icon"
                          className="h-auto"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Button
                      onClick={handleManualCheck}
                      disabled={checking}
                      variant="default"
                      size="lg"
                      className="w-full"
                    >
                      {checking ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Verificando pagamento...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-5 w-5" />
                          Já Paguei
                        </>
                      )}
                    </Button>

                    {polling && (
                      <Alert className="bg-primary/5 border-primary/20">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <AlertDescription className="text-primary font-medium">
                          🔍 Verificando pagamento automaticamente a cada 3 segundos...
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Instruções */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Abra o aplicativo do seu banco</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Escolha pagar com PIX via QR Code ou copia e cola</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Confirme o pagamento</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>A confirmação é instantânea</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}
