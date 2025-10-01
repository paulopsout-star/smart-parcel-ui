import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ChargeRefundTimeline } from '@/components/ChargeRefundTimeline';
import { ChargeExecutions } from '@/components/ChargeExecutions';
import { CheckoutSuccessModal } from '@/components/CheckoutSuccessModal';
import { Loader2, Eye, RefreshCw, ExternalLink, Copy, Plus, List } from 'lucide-react';
import { useChargeLinks } from '@/hooks/useChargeLinks';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Charge {
  id: string;
  payer_name: string;
  payer_email: string;
  amount: number;
  description: string;
  status: string;
  recurrence_type: string;
  has_boleto_link: boolean;
  created_at: string;
  next_charge_date: string | null;
  checkout_url?: string;
  checkout_link_id?: string;
  executions: Array<{
    id: string;
    execution_date: string;
    status: string;
    payment_link_url: string | null;
  }>;
}

export default function ChargeHistory() {
  const { isOperador } = useAuth();
  const { readOnly } = useSubscriptionContext();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null);
  const [executionsDialog, setExecutionsDialog] = useState<{ open: boolean; chargeId: string; chargeName: string }>({
    open: false,
    chargeId: '',
    chargeName: ''
  });
  const [executions, setExecutions] = useState<any[]>([]);
  
  // Checkout modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutModalData, setCheckoutModalData] = useState<any>(null);
  
  const { 
    loading: linksLoading, 
    executionsLoading,
    getPaymentLink, 
    generatePaymentLink, 
    copyToClipboard, 
    openPaymentLink,
    getChargeExecutions
  } = useChargeLinks();

  const fetchCharges = async () => {
    try {
      const { data, error } = await supabase
        .from('charges')
        .select(`
          *,
          executions:charge_executions(
            id,
            execution_date,
            status,
            payment_link_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCharges(data as Charge[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar cobranças",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processCharge = async (chargeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('process-charge', {
        body: { chargeId, immediate: true }
      });

      if (error) throw error;

      toast({
        title: "Cobrança processada",
        description: "A cobrança foi processada com sucesso",
      });

      fetchCharges();
    } catch (error: any) {
      toast({
        title: "Erro ao processar cobrança",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewExecutions = async (chargeId: string, chargeName: string) => {
    setExecutionsDialog({ open: true, chargeId, chargeName });
    const executionsList = await getChargeExecutions(chargeId);
    setExecutions(executionsList);
  };

  const CheckoutButtons = ({ charge }: { charge: Charge }) => {
    const [paymentLink, setPaymentLink] = useState<any>(null);
    const [linkChecked, setLinkChecked] = useState(false);
    const [localLoading, setLocalLoading] = useState(false);

    useEffect(() => {
      let mounted = true;

      const checkForLink = async () => {
        if (!linkChecked && !localLoading) {
          setLocalLoading(true);
          try {
            // Check if we have a stored checkout_url first
            if (charge.checkout_url && charge.checkout_link_id) {
              const storedLink = {
                id: charge.checkout_link_id,
                token: charge.checkout_link_id,
                url: charge.checkout_url,
                absolute_url: charge.checkout_url,
                status: 'active'
              };
              if (mounted) {
                setPaymentLink(storedLink);
                setLinkChecked(true);
                setLocalLoading(false);
              }
              return;
            }

            // If no stored link, try to get from remote
            const link = await getPaymentLink(charge.id);
            if (mounted) {
              setPaymentLink(link);
              setLinkChecked(true);
            }
          } catch (error) {
            console.error('Error checking payment link:', error);
            if (mounted) {
              setLinkChecked(true);
            }
          } finally {
            if (mounted) {
              setLocalLoading(false);
            }
          }
        }
      };

      checkForLink();

      return () => {
        mounted = false;
      };
    }, [charge.id, charge.checkout_url, charge.checkout_link_id, linkChecked, localLoading]);

    const handleGenerateLink = async () => {
      setLocalLoading(true);
      try {
        const newLink = await generatePaymentLink(charge.id);
        if (newLink) {
          setPaymentLink(newLink);
          
          // Open ModalCheckoutLink with the generated link
          const event = new CustomEvent('openCheckoutModal', {
            detail: {
              checkoutUrl: newLink.absolute_url,
              linkId: newLink.id,
              chargeId: charge.id,
              amount: charge.amount,
              payerName: charge.payer_name,
              description: charge.description
            }
          });
          window.dispatchEvent(event);
        }
      } finally {
        setLocalLoading(false);
      }
    };

    if (!linkChecked || localLoading) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            {localLoading ? 'Carregando...' : 'Verificando...'}
          </span>
        </div>
      );
    }

    if (paymentLink) {
      return (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // Validate URL before opening
              if (!paymentLink.absolute_url || (!paymentLink.absolute_url.startsWith('http://') && !paymentLink.absolute_url.startsWith('https://'))) {
                toast({
                  title: "Link inválido",
                  description: "URL de checkout inválida. Gerando nova...",
                  variant: "destructive",
                });
                handleGenerateLink();
                return;
              }
              openPaymentLink(paymentLink.absolute_url);
            }}
            disabled={linksLoading || localLoading || readOnly}
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            Abrir
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(paymentLink.absolute_url)}
            disabled={linksLoading || localLoading || readOnly}
          >
            <Copy className="w-4 h-4 mr-1" />
            Copiar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateLink}
            disabled={linksLoading || localLoading || readOnly}
          >
            <Plus className="w-4 h-4 mr-1" />
            Abrir Modal
          </Button>
        </div>
      );
    }

    return (
      <Button
        size="sm"
        variant="outline"
        onClick={handleGenerateLink}
        disabled={linksLoading || localLoading}
      >
        <Plus className="w-4 h-4 mr-1" />
        Gerar Link
      </Button>
    );
  };

  useEffect(() => {
    if (isOperador) {
      fetchCharges();
    }

    // Listen for custom event to open checkout modal
    const handleOpenCheckoutModal = (event: any) => {
      const data = event.detail;
      setCheckoutModalData({
        chargeId: data.chargeId,
        checkoutUrl: data.checkoutUrl,
        amount: data.amount,
        payerName: data.payerName,
        description: data.description,
        status: 'PENDENTE'
      });
      setShowCheckoutModal(true);
    };

    window.addEventListener('openCheckoutModal', handleOpenCheckoutModal);
    
    return () => {
      window.removeEventListener('openCheckoutModal', handleOpenCheckoutModal);
    };
  }, [isOperador]);

  if (!isOperador) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendente', variant: 'secondary' as const },
      processing: { label: 'Processando', variant: 'default' as const },
      completed: { label: 'Concluída', variant: 'default' as const },
      failed: { label: 'Falhou', variant: 'destructive' as const },
      cancelled: { label: 'Cancelada', variant: 'outline' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRecurrenceLabel = (type: string) => {
    const labels = {
      pontual: 'Pontual',
      diaria: 'Diária',
      semanal: 'Semanal',
      quinzenal: 'Quinzenal',
      mensal: 'Mensal',
      semestral: 'Semestral',
      anual: 'Anual'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Histórico de Cobranças</h1>
        <Button onClick={fetchCharges} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-6">
        {charges.map((charge) => (
          <Card key={charge.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{charge.payer_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{charge.payer_email}</p>
                  {charge.has_boleto_link && (
                    <Badge variant="outline" className="mt-1">
                      Com Boleto
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(charge.status)}
                  <Badge variant="outline">{getRecurrenceLabel(charge.recurrence_type)}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium">Valor</p>
                  <p className="text-lg">{formatCurrency(charge.amount)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Criado em</p>
                  <p>{format(new Date(charge.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                </div>
                {charge.next_charge_date && (
                  <div>
                    <p className="text-sm font-medium">Próxima cobrança</p>
                    <p>{format(new Date(charge.next_charge_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">Checkout</p>
                  <CheckoutButtons charge={charge} />
                </div>
              </div>

              {charge.description && (
                <div>
                  <p className="text-sm font-medium">Descrição</p>
                  <p className="text-sm text-muted-foreground">{charge.description}</p>
                </div>
              )}

              {charge.executions.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Execuções</p>
                  <div className="space-y-2">
                    {charge.executions.map((execution) => (
                      <div key={execution.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(execution.status)}
                          <span className="text-sm">
                            {format(new Date(execution.execution_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                        {execution.payment_link_url && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={execution.payment_link_url} target="_blank" rel="noopener noreferrer">
                              <Eye className="w-4 h-4 mr-1" />
                              Ver Link
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {charge.status === 'pending' && (
                  <Button 
                    size="sm" 
                    onClick={() => processCharge(charge.id)}
                    variant="outline"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Processar Agora
                  </Button>
                )}
                {charge.recurrence_type !== 'pontual' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewExecutions(charge.id, charge.payer_name)}
                  >
                    <List className="w-4 h-4 mr-1" />
                    Ver Execuções
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCharge(charge)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Ver Detalhes
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {charges.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">Nenhuma cobrança encontrada.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charge Details Dialog */}
      <Dialog open={!!selectedCharge} onOpenChange={(open) => !open && setSelectedCharge(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Cobrança</DialogTitle>
          </DialogHeader>
          {selectedCharge && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Informações Básicas</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Pagador:</strong> {selectedCharge.payer_name}</div>
                    <div><strong>Email:</strong> {selectedCharge.payer_email}</div>
                    <div><strong>Valor:</strong> {formatCurrency(selectedCharge.amount)}</div>
                    <div><strong>Descrição:</strong> {selectedCharge.description}</div>
                    <div><strong>Tipo:</strong> {getRecurrenceLabel(selectedCharge.recurrence_type)}</div>
                    <div><strong>Status:</strong> {getStatusBadge(selectedCharge.status)}</div>
                    {selectedCharge.has_boleto_link && (
                      <div><strong>Boleto:</strong> <Badge variant="outline">Com vínculo</Badge></div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Datas</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Criado em:</strong> {format(new Date(selectedCharge.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
                    {selectedCharge.next_charge_date && (
                      <div><strong>Próxima cobrança:</strong> {format(new Date(selectedCharge.next_charge_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
                    )}
                  </div>
                </div>
              </div>

              <ChargeRefundTimeline 
                chargeId={selectedCharge.id} 
                hasBoletoLink={selectedCharge.has_boleto_link}
              />

              <ChargeExecutions chargeId={selectedCharge.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Executions Dialog for Recurring Charges */}
      <Dialog open={executionsDialog.open} onOpenChange={(open) => setExecutionsDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execuções - {executionsDialog.chargeName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {executionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : executions.length > 0 ? (
              <div className="space-y-2">
                {executions.map((execution) => (
                  <div key={execution.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(execution.status)}
                        <span className="font-medium">
                          {execution.scheduled_for ? 
                            format(new Date(execution.scheduled_for), 'dd/MM/yyyy HH:mm', { locale: ptBR }) :
                            format(new Date(execution.execution_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          }
                        </span>
                      </div>
                      {execution.last_error && (
                        <p className="text-sm text-destructive">Erro: {execution.last_error}</p>
                      )}
                    </div>
                    {execution.status === 'READY' && execution.payment_link_id && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const baseUrl = window.location.origin;
                            const url = `${baseUrl}/payment?execution=${execution.id}`;
                            openPaymentLink(url);
                          }}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Abrir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const baseUrl = window.location.origin;
                            const url = `${baseUrl}/payment?execution=${execution.id}`;
                            copyToClipboard(url);
                          }}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Copiar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma execução encontrada para esta cobrança.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Success Modal */}
      {checkoutModalData && (
        <CheckoutSuccessModal
          open={showCheckoutModal}
          onOpenChange={setShowCheckoutModal}
          checkoutData={checkoutModalData}
        />
      )}
    </div>
  );
}