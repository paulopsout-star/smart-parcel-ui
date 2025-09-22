import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Shield, Lock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentSplits } from "@/components/PaymentSplits";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import autonegocie from "@/assets/autonegocie-logo.jpg";

interface Charge {
  id: string;
  payer_name: string;
  payer_email: string;
  amount: number;
  description: string;
  status: string;
  has_boleto_link: boolean;
  created_at: string;
}

export default function Payment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [charge, setCharge] = useState<Charge | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const { toast } = useToast();

  const chargeId = searchParams.get('charge');
  const token = searchParams.get('token');

  const loadCharge = async () => {
    if (!chargeId) {
      toast({
        title: 'Link inválido',
        description: 'ID da cobrança não encontrado',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('charges')
        .select('*')
        .eq('id', chargeId)
        .single();

      if (error) throw error;
      setCharge(data);

      if (data.status === 'completed') {
        setPaymentCompleted(true);
      }
    } catch (error: any) {
      console.error('Error loading charge:', error);
      toast({
        title: 'Erro ao carregar cobrança',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentComplete = () => {
    setPaymentCompleted(true);
    toast({
      title: 'Pagamento concluído!',
      description: 'Todos os splits foram processados com sucesso.',
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  useEffect(() => {
    loadCharge();
  }, [chargeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando cobrança...</p>
        </div>
      </div>
    );
  }

  if (!charge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Cobrança não encontrada</h2>
          <p className="text-muted-foreground">A cobrança solicitada não foi encontrada.</p>
        </div>
      </div>
    );
  }

  if (paymentCompleted || charge.status === 'completed') {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-4 h-4" />
                Início
              </Button>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <h1 className="text-xl font-semibold">Pagamento Concluído</h1>
              </div>
              <img
                src={autonegocie}
                alt="Logo da Auto Negocie"
                className="h-8 w-auto"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Pagamento Realizado com Sucesso!</h2>
            <p className="text-muted-foreground mb-8">
              Sua cobrança foi processada e todos os splits foram concluídos.
            </p>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Detalhes da Cobrança</h3>
                <div className="space-y-2 text-left">
                  <div className="flex justify-between">
                    <span>Valor:</span>
                    <span className="font-medium">{formatCurrency(charge.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Descrição:</span>
                    <span className="font-medium">{charge.description}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-4 h-4" />
              Início
            </Button>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-semibold">Pagamento da Cobrança</h1>
            </div>
            <img
              src={autonegocie}
              alt="Logo da Auto Negocie"
              className="h-8 w-auto"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Payment Splits */}
            <div className="lg:col-span-2">
              <PaymentSplits
                chargeId={charge.id}
                totalAmount={charge.amount}
                hasBoletoLink={charge.has_boleto_link}
                onPaymentComplete={handlePaymentComplete}
              />
            </div>

            {/* Charge Summary */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes da Cobrança</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Valor</div>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(charge.amount)}
                    </div>
                  </div>
                  
                  {charge.description && (
                    <div>
                      <div className="text-sm text-muted-foreground">Descrição</div>
                      <div className="font-medium">{charge.description}</div>
                    </div>
                  )}

                  <div>
                    <div className="text-sm text-muted-foreground">Pagador</div>
                    <div className="font-medium">{charge.payer_name}</div>
                    <div className="text-sm text-muted-foreground">{charge.payer_email}</div>
                  </div>

                  {charge.has_boleto_link && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium text-orange-600">
                        🎫 Cobrança com vínculo de boleto
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security Info */}
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border">
                <Shield className="w-5 h-5 text-success" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Pagamento 100% Seguro</p>
                  <p className="text-xs text-muted-foreground">
                    Seus dados são protegidos por criptografia SSL
                  </p>
                </div>
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}