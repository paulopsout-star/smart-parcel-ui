import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, Clock, Copy, QrCode, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PixData {
  qr_code: string;
  qr_code_base64: string;
  ticket_url?: string;
  payment_id: string;
  status: string;
  expiration?: string;
  amount_cents: number;
}

interface PaymentSplit {
  id: string;
  charge_id: string | null;
  payment_link_id: string | null;
  amount_cents: number;
  display_amount_cents: number | null;
  method: string;
  status: string;
  mp_payment_id: string | null;
  mp_qr_code: string | null;
  mp_qr_code_base64: string | null;
  mp_ticket_url: string | null;
  mp_status: string | null;
  pix_paid_at: string | null;
}

interface ChargeData {
  id: string;
  payer_name: string;
  payer_email: string;
  payer_document: string;
  description: string | null;
}

const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
};

export default function PaymentPix() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [split, setSplit] = useState<PaymentSplit | null>(null);
  const [charge, setCharge] = useState<ChargeData | null>(null);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  // Fetch split and charge data
  useEffect(() => {
    async function fetchData() {
      if (!id) {
        setError('ID não fornecido');
        setLoading(false);
        return;
      }

      try {
        let splitData = null;

        // Strategy 1: Try to find charge by checkout_link_id or id, then get its PIX split
        const { data: chargeData } = await supabase
          .from('charges')
          .select('id')
          .or(`checkout_link_id.eq.${id},id.eq.${id}`)
          .maybeSingle();

        if (chargeData?.id) {
          // Found charge, now get the PIX split for this charge
          const { data: splitByCharge, error: splitByChargeError } = await supabase
            .from('payment_splits')
            .select('*')
            .eq('charge_id', chargeData.id)
            .eq('method', 'pix')
            .maybeSingle();

          if (splitByChargeError) {
            console.error('PaymentPix: Error fetching split by charge_id:', splitByChargeError);
          }
          splitData = splitByCharge;
        }

        // Strategy 2: Fallback - try to find split directly by id (for legacy URLs with split id)
        if (!splitData) {
          const { data: splitById, error: splitByIdError } = await supabase
            .from('payment_splits')
            .select('*')
            .eq('id', id)
            .eq('method', 'pix')
            .maybeSingle();

          if (splitByIdError) {
            console.error('PaymentPix: Error fetching split by id:', splitByIdError);
          }
          splitData = splitById;
        }

        if (!splitData) {
          console.error('PaymentPix: PIX split not found for id:', id);
          setError('Pagamento PIX não encontrado');
          setLoading(false);
          return;
        }

        setSplit(splitData as PaymentSplit);

        // Check if already paid
        if (splitData.status === 'concluded' || splitData.pix_paid_at) {
          // Redirect based on whether there's a card payment pending
          const { data: otherSplits } = await supabase
            .from('payment_splits')
            .select('id, method, status')
            .eq('charge_id', splitData.charge_id)
            .neq('id', id);

          const cardSplit = otherSplits?.find(s => s.method === 'CARD' && s.status === 'pending');
          if (cardSplit) {
            navigate(`/payment-card/${cardSplit.id}`, { replace: true });
          } else {
            navigate(`/thank-you?pl=${splitData.payment_link_id || splitData.charge_id}`, { replace: true });
          }
          return;
        }

        // Fetch charge data for payer info
        if (splitData.charge_id) {
          const { data: chargeData } = await supabase
            .from('charges')
            .select('id, payer_name, payer_email, payer_document, description')
            .eq('id', splitData.charge_id)
            .single();

          if (chargeData) {
            setCharge(chargeData);
          }
        }

        // If we already have MP data, use it
        if (splitData.mp_payment_id && splitData.mp_qr_code && splitData.mp_qr_code_base64) {
          setPixData({
            payment_id: splitData.mp_payment_id,
            qr_code: splitData.mp_qr_code,
            qr_code_base64: splitData.mp_qr_code_base64,
            ticket_url: splitData.mp_ticket_url || undefined,
            status: splitData.mp_status || 'pending',
            amount_cents: splitData.display_amount_cents || splitData.amount_cents,
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Erro ao carregar dados do pagamento');
        setLoading(false);
      }
    }

    fetchData();
  }, [id, navigate]);

  // Create PIX payment if needed
  const createPixPayment = useCallback(async () => {
    if (!split || !charge || pixData) return;

    setCreating(true);
    try {
      const amountCents = split.display_amount_cents || split.amount_cents;

      const { data, error: createError } = await supabase.functions.invoke('mercadopago-pix-create', {
        body: {
          payment_split_id: split.id,
          charge_id: split.charge_id,
          amount_cents: amountCents,
          payer_name: charge.payer_name,
          payer_email: charge.payer_email,
          payer_document: charge.payer_document,
          description: charge.description || 'Pagamento via PIX - Autonegocie',
        },
      });

      if (createError) {
        console.error('Error creating PIX:', createError);
        toast.error('Erro ao gerar QR Code PIX');
        setError('Erro ao gerar QR Code. Tente novamente.');
        return;
      }

      if (data.success) {
        setPixData({
          payment_id: data.payment_id,
          qr_code: data.qr_code,
          qr_code_base64: data.qr_code_base64,
          ticket_url: data.ticket_url,
          status: data.status,
          expiration: data.expiration,
          amount_cents: amountCents,
        });
      } else {
        setError(data.error || 'Erro ao criar pagamento PIX');
      }
    } catch (err) {
      console.error('Error creating PIX payment:', err);
      setError('Erro ao conectar com o serviço de pagamento');
    } finally {
      setCreating(false);
    }
  }, [split, charge, pixData]);

  // Create PIX after charge data is loaded
  useEffect(() => {
    if (split && charge && !pixData && !creating && !error) {
      createPixPayment();
    }
  }, [split, charge, pixData, creating, error, createPixPayment]);

  // Poll for payment status
  useEffect(() => {
    if (!pixData || pixData.status === 'approved') return;

    const checkStatus = async () => {
      try {
        const { data, error: statusError } = await supabase.functions.invoke('mercadopago-pix-status', {
          body: {
            payment_split_id: id,
          },
        });

        if (statusError) {
          console.error('Error checking status:', statusError);
          return;
        }

        if (data.pix_paid) {
          toast.success('Pagamento PIX confirmado!');
          
          // Check for card payment
          const { data: otherSplits } = await supabase
            .from('payment_splits')
            .select('id, method, status')
            .eq('charge_id', split?.charge_id)
            .neq('id', id);

          const cardSplit = otherSplits?.find(s => s.method === 'CARD' && s.status === 'pending');
          if (cardSplit) {
            navigate(`/payment-card/${cardSplit.id}`, { replace: true });
          } else {
            navigate(`/thank-you?pl=${split?.payment_link_id || split?.charge_id}`, { replace: true });
          }
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    };

    const interval = setInterval(checkStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [pixData, id, split, navigate]);

  const handleCopyCode = async () => {
    if (!pixData?.qr_code) return;

    try {
      await navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast.error('Erro ao copiar código');
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const { data, error: statusError } = await supabase.functions.invoke('mercadopago-pix-status', {
        body: {
          payment_split_id: id,
        },
      });

      if (statusError) {
        toast.error('Erro ao verificar status');
        return;
      }

      if (data.pix_paid) {
        toast.success('Pagamento confirmado!');
        
        const { data: otherSplits } = await supabase
          .from('payment_splits')
          .select('id, method, status')
          .eq('charge_id', split?.charge_id)
          .neq('id', id);

        const cardSplit = otherSplits?.find(s => s.method === 'CARD' && s.status === 'pending');
        if (cardSplit) {
          navigate(`/payment-card/${cardSplit.id}`, { replace: true });
        } else {
          navigate(`/thank-you?pl=${split?.payment_link_id || split?.charge_id}`, { replace: true });
        }
      } else {
        toast.info('Aguardando pagamento...');
      }
    } catch (err) {
      toast.error('Erro ao verificar status');
    } finally {
      setChecking(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-6 space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-64 w-64 mx-auto rounded-xl" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-6 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10 mx-auto">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold">Erro no Pagamento</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </Card>
      </div>
    );
  }

  // Creating PIX state
  if (creating || !pixData) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-6 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mx-auto animate-pulse">
            <QrCode className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Gerando QR Code PIX...</h1>
          <p className="text-muted-foreground">Aguarde enquanto preparamos seu pagamento</p>
          <div className="flex justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        </Card>
      </div>
    );
  }

  const displayAmount = pixData.amount_cents;

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <Card className="max-w-lg w-full p-6 lg:p-8 rounded-2xl shadow-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <QrCode className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Pagamento via PIX</h1>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
            <Clock className="w-3 h-3 mr-1" />
            Aguardando Pagamento
          </Badge>
        </div>

        {/* Amount */}
        <div className="text-center py-4 bg-muted rounded-xl">
          <p className="text-sm text-muted-foreground mb-1">Valor a pagar</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(displayAmount)}</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-2xl shadow-sm border">
            <img
              src={`data:image/png;base64,${pixData.qr_code_base64}`}
              alt="QR Code PIX"
              className="w-56 h-56 sm:w-64 sm:h-64"
            />
          </div>
        </div>

        {/* Copy Code Button */}
        <div className="space-y-3">
          <Button
            onClick={handleCopyCode}
            variant="outline"
            className="w-full h-12 text-base"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
                Código copiado!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5 mr-2" />
                Copiar código PIX
              </>
            )}
          </Button>
        </div>

        {/* Instructions */}
        <div className="bg-muted/50 rounded-xl p-4 space-y-2">
          <h3 className="font-medium text-sm">Como pagar:</h3>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Abra o app do seu banco</li>
            <li>Escolha pagar com PIX</li>
            <li>Escaneie o QR Code ou copie o código</li>
            <li>Confirme o pagamento</li>
          </ol>
        </div>

        {/* Check Status Button */}
        <Button
          onClick={handleCheckStatus}
          disabled={checking}
          className="w-full h-12"
        >
          {checking ? (
            <>
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5 mr-2" />
              Já paguei - Verificar status
            </>
          )}
        </Button>

        {/* Auto-check info */}
        <p className="text-xs text-center text-muted-foreground">
          O status é verificado automaticamente a cada 5 segundos
        </p>
      </Card>
    </div>
  );
}
