import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChargeRefundTimeline } from '@/components/ChargeRefundTimeline';
import { ChargeExecutions } from '@/components/ChargeExecutions';
import { CheckoutSuccessModal } from '@/components/CheckoutSuccessModal';
import { Loader2, Eye, RefreshCw, ExternalLink, Copy, Plus, List, Link2, User, Mail, Phone, Calendar as CalendarIcon, CreditCard, FileText, Filter, X, Search, AlertCircle, Info, ArrowLeft, QrCode, Wallet, TrendingUp, Percent } from 'lucide-react';
import { useChargeLinks } from '@/hooks/useChargeLinks';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ptBR } from 'date-fns/locale';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface PaymentSplitInfo {
  id: string;
  method: string;
  amount_cents: number;
  status: string;
  pix_paid_at?: string;
  pre_payment_key?: string;
  transaction_id?: string;
  processed_at?: string;
  order_index: number;
  installments?: number;
}

interface Charge {
  id: string;
  payer_name: string;
  payer_email: string;
  payer_phone: string;
  payer_document: string;
  amount: number;
  description: string;
  status: string;
  recurrence_type: string;
  has_boleto_link: boolean;
  created_at: string;
  next_charge_date: string | null;
  checkout_url?: string;
  checkout_link_id?: string;
  payment_method?: string;
  pix_amount?: number;
  card_amount?: number;
  fee_amount?: number;
  fee_percentage?: number;
  pre_payment_key?: string;
  boleto_linha_digitavel?: string;
  creditor_document?: string;
  creditor_name?: string;
  metadata?: {
    link_boleto_error?: {
      message: string;
      attemptedAt: string;
      httpStatus?: number;
    };
  };
  executions: Array<{
    id: string;
    execution_date: string;
    status: string;
    payment_link_url: string | null;
  }>;
  splits?: PaymentSplitInfo[];
}

interface ChargeFilters {
  status: string;
  recurrence_type: string;
  date_from: Date | undefined;
  date_to: Date | undefined;
  payer_document: string;
}

// Helper functions
const getInitials = (name: string) => {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
};

const formatPhone = (phone: string) => {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
  }
  return phone;
};

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
};

const getModernStatusBadge = (status: string) => {
  const configs = {
    // Status básicos
    pending: { 
      label: 'Pendente', 
      variant: 'warning' as const
    },
    processing: { 
      label: 'Processando', 
      variant: 'info' as const
    },
    completed: { 
      label: 'Pago', 
      variant: 'success' as const
    },
    failed: { 
      label: 'Falhou', 
      variant: 'destructive' as const
    },
    cancelled: { 
      label: 'Cancelada', 
      variant: 'secondary' as const
    },
    // Status do fluxo Quita+ (StatusCode 1-9)
    pre_authorized: { 
      label: 'Pré-autorizado', 
      variant: 'info' as const
    },
    boleto_linked: { 
      label: 'Boleto Vinculado', 
      variant: 'success' as const
    },
    approved: { 
      label: 'Aprovado', 
      variant: 'success' as const
    },
    awaiting_validation: { 
      label: 'Aguardando PIN', 
      variant: 'warning' as const
    },
    validating: { 
      label: 'Em Análise de Risco', 
      variant: 'info' as const
    },
    payment_denied: { 
      label: 'Negado pelo Risco', 
      variant: 'destructive' as const
    },
  };
  
  const config = configs[status as keyof typeof configs] || configs.pending;
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
};

const getPaymentMethodBadge = (method: string) => {
  const configs = {
    cartao: { label: 'Cartão', variant: 'info' as const },
    cartao_pix: { label: 'PIX + Cartão', variant: 'default' as const },
    pix: { label: 'PIX', variant: 'success' as const },
    boleto: { label: 'Boleto', variant: 'warning' as const },
  };
  const config = configs[method as keyof typeof configs] || configs.cartao;
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

// Componente para exibir os métodos de pagamento (splits) com breakdown de taxas
const PaymentMethodsSummary = ({ charge }: { charge: Charge }) => {
  const splits = charge.splits || [];
  
  const pixSplit = splits.find(s => s.method === 'pix');
  const cardSplit = splits.find(s => s.method === 'credit_card');

  // Cálculos para PIX
  const pixBase = charge.pix_amount || 0;
  const pixTotal = pixSplit?.amount_cents || pixBase;
  const pixFee = pixTotal > pixBase ? pixTotal - pixBase : 0;
  const pixFeePercent = pixBase > 0 && pixFee > 0 
    ? ((pixFee / pixBase) * 100).toFixed(1) 
    : null;

  // Cálculos para Cartão
  const cardBase = charge.card_amount || 0;
  const cardTotal = cardSplit?.amount_cents || cardBase;
  const cardFee = cardTotal > cardBase ? cardTotal - cardBase : 0;
  const cardFeePercent = cardBase > 0 && cardFee > 0 
    ? ((cardFee / cardBase) * 100).toFixed(1) 
    : null;

  const getSplitStatusBadge = (split: PaymentSplitInfo | undefined, isPix: boolean) => {
    if (!split) return null;
    const isPaid = split.status === 'concluded' || split.pix_paid_at || split.pre_payment_key || split.transaction_id;
    if (isPaid) {
      return <Badge variant="success" className="text-xs">✓ Pago</Badge>;
    }
    return <Badge variant="warning" className="text-xs">⏳ Pendente</Badge>;
  };

  // Se não há splits e não é pagamento combinado
  if (splits.length === 0 && charge.payment_method !== 'cartao_pix') {
    return null;
  }

  const hasPix = pixSplit || (charge.payment_method === 'cartao_pix' && pixBase > 0);
  const hasCard = cardSplit || (charge.payment_method === 'cartao_pix' && cardBase > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-ds-text-strong">
        <Wallet className="h-4 w-4" />
        Métodos de Pagamento
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* PIX Card */}
        {hasPix && (
          <div className="p-4 bg-green-500/5 rounded-card border border-green-500/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <QrCode className="h-4 w-4 text-green-600" />
                </div>
                <span className="font-medium text-green-700">PIX</span>
              </div>
              {getSplitStatusBadge(pixSplit, true)}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-ds-text-muted">
                <span>Valor base:</span>
                <span>{formatCurrency(pixBase)}</span>
              </div>
              {pixFee > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Taxa ({pixFeePercent}%):</span>
                  <span>+ {formatCurrency(pixFee)}</span>
                </div>
              )}
              <div className="border-t border-green-500/10 pt-1.5 mt-1.5">
                <div className="flex justify-between font-semibold text-green-700">
                  <span>Total pago:</span>
                  <span>{formatCurrency(pixTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card Card */}
        {hasCard && (
          <div className="p-4 bg-blue-500/5 rounded-card border border-blue-500/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                </div>
                <span className="font-medium text-blue-700">
                  Cartão {cardSplit?.installments && cardSplit.installments > 1 ? `(${cardSplit.installments}x)` : ''}
                </span>
              </div>
              {getSplitStatusBadge(cardSplit, false)}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-ds-text-muted">
                <span>Valor base:</span>
                <span>{formatCurrency(cardBase)}</span>
              </div>
              {cardFee > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>Juros ({cardFeePercent}%):</span>
                  <span>+ {formatCurrency(cardFee)}</span>
                </div>
              )}
              <div className="border-t border-blue-500/10 pt-1.5 mt-1.5">
                <div className="flex justify-between font-semibold text-blue-700">
                  <span>Total pago:</span>
                  <span>{formatCurrency(cardTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Total Geral */}
      {hasPix && hasCard && (
        <div className="p-3 bg-ds-bg-surface-alt rounded-card border border-ds-border-subtle flex justify-between items-center">
          <div className="flex items-center gap-2 text-ds-text-muted">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">Total pago pelo cliente:</span>
          </div>
          <span className="text-lg font-bold text-ds-text-strong">
            {formatCurrency(pixTotal + cardTotal)}
          </span>
        </div>
      )}
    </div>
  );
};

// InfoCard Component
interface InfoCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subvalue?: string;
  variant?: 'default' | 'primary' | 'success' | 'info';
}

const InfoCard = ({ icon: Icon, label, value, subvalue, variant = 'default' }: InfoCardProps) => {
  const variants = {
    default: 'bg-ds-bg-surface-alt border-ds-border-subtle',
    primary: 'bg-primary/5 border-primary/10',
    success: 'bg-green-500/5 border-green-500/10',
    info: 'bg-blue-500/5 border-blue-500/10',
  };
  
  const iconVariants = {
    default: 'bg-ds-bg-surface text-ds-text-muted',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-500/10 text-green-600',
    info: 'bg-blue-500/10 text-blue-600',
  };

  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-card border", variants[variant])}>
      <div className={cn("p-2.5 rounded-lg", iconVariants[variant])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ds-text-muted uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className="text-base font-semibold text-ds-text-strong truncate">{value}</p>
        {subvalue && (
          <p className="text-xs text-ds-text-muted mt-0.5">{subvalue}</p>
        )}
      </div>
    </div>
  );
};

// Skeleton Component
const ChargeCardSkeleton = () => (
  <Card className="overflow-hidden">
    <CardHeader className="pb-4 bg-ds-bg-surface-alt">
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
      </div>
      <Skeleton className="h-16 rounded-card" />
      <Skeleton className="h-20 rounded-card" />
    </CardContent>
  </Card>
);

// Executions Dialog Component
const ExecutionsDialogContent = ({ 
  executionsDialog, 
  setExecutionsDialog, 
  openPaymentLink, 
  copyToClipboard 
}: any) => {
  const { getChargeExecutions } = useChargeLinks();
  const executionsQuery = getChargeExecutions(executionsDialog.chargeId);

  return (
    <Dialog open={executionsDialog.open} onOpenChange={(open) => setExecutionsDialog((prev: any) => ({ ...prev, open }))}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Execuções - {executionsDialog.chargeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {executionsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : executionsQuery.data && executionsQuery.data.length > 0 ? (
            <div className="space-y-2">
              {executionsQuery.data.map((execution: any) => (
                <div key={execution.id} className="flex items-center justify-between p-4 border border-ds-border-subtle rounded-card bg-ds-bg-surface">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getModernStatusBadge(execution.status)}
                      <span className="font-medium text-ds-text-strong">
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
            <div className="text-center py-8 text-ds-text-muted">
              Nenhuma execução encontrada para esta cobrança.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function ChargeHistory() {
  const { isOperador } = useAuth();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [filteredCharges, setFilteredCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null);
  const [executionsDialog, setExecutionsDialog] = useState<{ open: boolean; chargeId: string; chargeName: string }>({
    open: false,
    chargeId: '',
    chargeName: ''
  });
  
  // Filter state
  const [filters, setFilters] = useState<ChargeFilters>({
    status: 'all',
    recurrence_type: 'all',
    date_from: undefined,
    date_to: undefined,
    payer_document: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Checkout modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutModalData, setCheckoutModalData] = useState<any>(null);
  
  const {
    copyToClipboard,
    openPaymentLink
  } = useChargeLinks();

  const fetchCharges = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('charges')
        .select(`
          *,
          executions:charge_executions(
            id,
            execution_date,
            status,
            payment_link_url
          ),
          splits:payment_splits(
            id,
            method,
            amount_cents,
            status,
            pix_paid_at,
            pre_payment_key,
            transaction_id,
            processed_at,
            order_index,
            installments
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Deduplicate splits by method (keep the most recent)
      const processedData = (data || []).map(charge => {
        if (charge.splits && charge.splits.length > 0) {
          const splitsByMethod = new Map<string, any>();
          charge.splits.forEach((split: any) => {
            const existing = splitsByMethod.get(split.method);
            if (!existing || new Date(split.created_at) > new Date(existing.created_at)) {
              splitsByMethod.set(split.method, split);
            }
          });
          charge.splits = Array.from(splitsByMethod.values()).sort((a, b) => a.order_index - b.order_index);
        }
        return charge;
      });
      
      setCharges(processedData as Charge[]);
      setFilteredCharges(processedData as Charge[]);
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

  const applyFilters = () => {
    let filtered = [...charges];

    if (filters.status !== 'all') {
      filtered = filtered.filter(charge => charge.status === filters.status);
    }

    if (filters.recurrence_type !== 'all') {
      filtered = filtered.filter(charge => charge.recurrence_type === filters.recurrence_type);
    }

    if (filters.date_from) {
      filtered = filtered.filter(charge => {
        const chargeDate = new Date(charge.created_at);
        return chargeDate >= filters.date_from!;
      });
    }

    if (filters.date_to) {
      filtered = filtered.filter(charge => {
        const chargeDate = new Date(charge.created_at);
        const dateTo = new Date(filters.date_to!);
        dateTo.setHours(23, 59, 59, 999);
        return chargeDate <= dateTo;
      });
    }

    if (filters.payer_document) {
      const searchTerm = filters.payer_document.replace(/\D/g, '');
      filtered = filtered.filter(charge => 
        charge.payer_document?.replace(/\D/g, '').includes(searchTerm)
      );
    }

    setFilteredCharges(filtered);
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      recurrence_type: 'all',
      date_from: undefined,
      date_to: undefined,
      payer_document: ''
    });
    setFilteredCharges(charges);
  };

  const hasActiveFilters = () => {
    return filters.status !== 'all' || 
           filters.recurrence_type !== 'all' || 
           filters.date_from !== undefined || 
           filters.date_to !== undefined || 
           filters.payer_document !== '';
  };

  const processCharge = async (chargeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('process-charge', {
        body: { chargeId, immediate: true }
      });

      if (error) throw error;

      toast({
        title: "✓ Cobrança processada",
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

  const handleRetryLinkBoleto = async (charge: Charge) => {
    if (!charge.pre_payment_key || !charge.boleto_linha_digitavel) {
      toast({
        title: "Erro",
        description: "Dados insuficientes para vincular boleto.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({ title: "Verificando status...", description: "Aguarde..." });
      
      // ✅ PRIMEIRO: Verificar status atual na API Cappta
      const { data: statusData } = await supabase.functions.invoke('quitaplus-prepayment-status', {
        body: { prePaymentKey: charge.pre_payment_key }
      });

      console.log('[ChargeHistory] Status da API Cappta:', statusData);

      // Se já está LINKED, atualizar DB e não tentar vincular novamente
      if (statusData?.success && statusData?.status === 'LINKED') {
        toast({
          title: "✅ Já vinculado!",
          description: "O boleto já foi vinculado com sucesso na API.",
        });
        
        // Atualizar status no banco
        await supabase.from('charges')
          .update({ 
            status: 'boleto_linked',
            boleto_linked_at: new Date().toISOString(),
            metadata: { ...charge.metadata, link_boleto_error: null }
          })
          .eq('id', charge.id);
          
        fetchCharges();
        return;
      }

      // Se não está AUTHORIZED, não pode vincular
      if (statusData?.success && statusData?.status !== 'AUTHORIZED') {
        toast({
          title: "Status inválido",
          description: `Status atual: ${statusData?.status}. Não é possível vincular.`,
          variant: "destructive",
        });
        return;
      }

      // ✅ SEGUNDO: Tentar vincular boleto
      toast({ title: "Vinculando boleto...", description: "Aguarde..." });
      
      const { data, error } = await supabase.functions.invoke('quitaplus-link-boleto', {
        body: {
          prePaymentKey: charge.pre_payment_key,
          paymentLinkId: charge.id,
          boleto: {
            number: charge.boleto_linha_digitavel.replace(/\D/g, ''),
            creditorDocument: charge.creditor_document?.replace(/\D/g, '') || '',
            creditorName: charge.creditor_name || '',
          },
        },
      });

      if (error || data?.error) {
        const errorMessage = error?.message || data?.message || data?.error || 'Erro desconhecido';
        toast({
          title: "Erro ao vincular",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso!",
          description: "Boleto vinculado com sucesso.",
        });
        
        // Atualizar status da charge para boleto_linked e limpar erro
        await supabase.from('charges')
          .update({ 
            status: 'boleto_linked',
            boleto_linked_at: new Date().toISOString(),
            metadata: { ...charge.metadata, link_boleto_error: null }
          })
          .eq('id', charge.id);
          
        fetchCharges(); // Recarregar lista
      }
    } catch (err) {
      console.error('Erro ao tentar vincular boleto:', err);
      toast({
        title: "Erro inesperado",
        description: "Falha ao vincular boleto. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleViewExecutions = (chargeId: string, chargeName: string) => {
    setExecutionsDialog({ open: true, chargeId, chargeName });
  };

  const CheckoutButtons = ({ charge }: { charge: Charge }) => {
    const { getExistingLink, generateLink, isGenerating, resetLinkState } = useChargeLinks();
    const linkQuery = getExistingLink(charge.id);
    const isCompleted = charge.status === 'completed';

    const handleGenerateLink = async () => {
      try {
        const newLink = await generateLink(charge.id);
        if (newLink?.url) {
          const event = new CustomEvent('openCheckoutModal', {
            detail: {
              checkoutUrl: newLink.url,
              linkId: newLink.linkId,
              chargeId: charge.id,
              amount: charge.amount,
              payerName: charge.payer_name,
              description: charge.description
            }
          });
          window.dispatchEvent(event);
        }
      } catch (error) {
        console.error('Error generating link:', error);
      }
    };

    if (linkQuery.isLoading) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-ds-text-muted">Carregando...</span>
        </div>
      );
    }

    if (linkQuery.data === null || !linkQuery.data?.url) {
      return (
        <div className="space-y-3">
          {isCompleted && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Info className="h-4 w-4" />
              <span>Pagamento já concluído</span>
            </div>
          )}
          {!isCompleted && (
            <div className="flex items-center gap-2 text-sm text-ds-text-muted">
              <AlertCircle className="h-4 w-4" />
              <span>Link de pagamento indisponível</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => { resetLinkState(charge.id); linkQuery.refetch(); }} 
              size="sm" 
              variant="outline"
              className="gap-2"
              disabled={isCompleted}
            >
              <RefreshCw className="h-4 w-4" />
              Tentar Novamente
            </Button>
            <Button 
              onClick={handleGenerateLink} 
              size="sm"
              disabled={isGenerating || isCompleted}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Gerar Novo Link
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => openPaymentLink(linkQuery.data.url)}
          className="gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir Link
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => copyToClipboard(linkQuery.data.url)}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          Copiar
        </Button>
      </div>
    );
  };

  useEffect(() => {
    fetchCharges();
    
    const handleOpenCheckoutModal = (event: CustomEvent) => {
      setCheckoutModalData(event.detail);
      setShowCheckoutModal(true);
    };
    
    window.addEventListener('openCheckoutModal', handleOpenCheckoutModal as EventListener);
    return () => window.removeEventListener('openCheckoutModal', handleOpenCheckoutModal as EventListener);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, charges]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ds-text-strong">Histórico de Cobranças</h1>
            <p className="text-ds-text-muted">Gerencie e acompanhe todas as suas cobranças</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {hasActiveFilters() && (
                <Badge variant="default" className="ml-2">!</Badge>
              )}
            </Button>
            <Button onClick={fetchCharges} variant="outline" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button asChild>
              <Link to="/new-charge">
                <Plus className="w-4 h-4 mr-2" />
                Nova Cobrança
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ds-text-muted">Status</label>
                  <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="processing">Processando</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="failed">Falhou</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ds-text-muted">Recorrência</label>
                  <Select value={filters.recurrence_type} onValueChange={(value) => setFilters(prev => ({ ...prev, recurrence_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="pontual">Pontual</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ds-text-muted">Data Inicial</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.date_from ? format(filters.date_from, 'dd/MM/yyyy') : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={filters.date_from}
                        onSelect={(date) => setFilters(prev => ({ ...prev, date_from: date }))}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ds-text-muted">Data Final</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.date_to ? format(filters.date_to, 'dd/MM/yyyy') : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={filters.date_to}
                        onSelect={(date) => setFilters(prev => ({ ...prev, date_to: date }))}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ds-text-muted">CPF/CNPJ</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Buscar por documento"
                      value={filters.payer_document}
                      onChange={(e) => setFilters(prev => ({ ...prev, payer_document: e.target.value }))}
                    />
                    {hasActiveFilters() && (
                      <Button variant="ghost" size="icon" onClick={clearFilters}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results count */}
        <div className="text-sm text-ds-text-muted">
          {loading ? 'Carregando...' : `${filteredCharges.length} cobrança(s) encontrada(s)`}
        </div>

        {/* Charges List */}
        {loading ? (
          <div className="space-y-4">
            <ChargeCardSkeleton />
            <ChargeCardSkeleton />
            <ChargeCardSkeleton />
          </div>
        ) : filteredCharges.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto text-ds-text-muted mb-4" />
                <h3 className="text-lg font-medium text-ds-text-strong mb-2">Nenhuma cobrança encontrada</h3>
                <p className="text-ds-text-muted mb-4">
                  {hasActiveFilters() ? 'Tente ajustar os filtros' : 'Comece criando sua primeira cobrança'}
                </p>
                {!hasActiveFilters() && (
                  <Button asChild>
                    <Link to="/new-charge">
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Cobrança
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredCharges.map((charge) => (
              <Card key={charge.id} className="overflow-hidden hover:shadow-floating transition-shadow duration-200">
                <CardHeader className="bg-ds-bg-surface-alt border-b border-ds-border-subtle">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 border-2 border-ds-bg-surface">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {getInitials(charge.payer_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-ds-text-strong">{charge.payer_name}</h3>
                        <p className="text-sm text-ds-text-muted">{charge.payer_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getModernStatusBadge(charge.status)}
                      {charge.payment_method && getPaymentMethodBadge(charge.payment_method)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <InfoCard
                      icon={CreditCard}
                      label="Valor Total"
                      value={formatCurrency(charge.amount)}
                      variant="primary"
                    />
                    <InfoCard
                      icon={CalendarIcon}
                      label="Criado em"
                      value={format(new Date(charge.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      subvalue={format(new Date(charge.created_at), 'HH:mm', { locale: ptBR })}
                    />
                    <InfoCard
                      icon={Phone}
                      label="Telefone"
                      value={formatPhone(charge.payer_phone)}
                    />
                    <InfoCard
                      icon={FileText}
                      label="Descrição"
                      value={charge.description || 'Sem descrição'}
                    />
                  </div>
                  
                  {/* Métodos de Pagamento (Splits) */}
                  {(charge.payment_method === 'cartao_pix' || (charge.splits && charge.splits.length > 0)) && (
                    <div className="mb-6">
                      <p className="text-xs font-medium text-ds-text-muted uppercase tracking-wider mb-2">
                        Métodos de Pagamento
                      </p>
                      <PaymentMethodsSummary charge={charge} />
                    </div>
                  )}
                  
                  {/* Alerta de erro no vínculo de boleto - só mostra se status ainda é pre_authorized e não foi vinculado */}
                  {charge.metadata?.link_boleto_error && 
                   charge.status === 'pre_authorized' && 
                   !['boleto_linked', 'completed', 'approved'].includes(charge.status) && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                            Erro ao vincular boleto
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                            O cartão foi aprovado, mas houve falha ao vincular o boleto.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetryLinkBoleto(charge)}
                            className="mt-3 gap-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Tentar Vincular Novamente
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-ds-border-subtle">
                    <CheckoutButtons charge={charge} />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCharge(charge)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Detalhes
                      </Button>
                      {charge.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => processCharge(charge.id)}
                        >
                          Processar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Charge Details Sheet */}
        <Sheet open={!!selectedCharge} onOpenChange={() => setSelectedCharge(null)}>
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            {selectedCharge && (
              <>
                <SheetHeader>
                  <SheetTitle>Detalhes da Cobrança</SheetTitle>
                  <SheetDescription>
                    ID: {selectedCharge.id.slice(0, 8)}...
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-6 py-6">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoCard icon={User} label="Pagador" value={selectedCharge.payer_name} />
                    <InfoCard icon={Mail} label="Email" value={selectedCharge.payer_email} />
                    <InfoCard icon={Phone} label="Telefone" value={formatPhone(selectedCharge.payer_phone)} />
                    <InfoCard icon={CreditCard} label="Valor" value={formatCurrency(selectedCharge.amount)} variant="primary" />
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-ds-text-strong">Status</h4>
                    <div className="flex gap-2">
                      {getModernStatusBadge(selectedCharge.status)}
                      <Badge variant="outline">{selectedCharge.recurrence_type}</Badge>
                      {selectedCharge.payment_method && getPaymentMethodBadge(selectedCharge.payment_method)}
                    </div>
                  </div>

                  {/* Métodos de Pagamento Detalhados */}
                  {(selectedCharge.payment_method === 'cartao_pix' || (selectedCharge.splits && selectedCharge.splits.length > 0)) && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-ds-text-strong">Métodos de Pagamento</h4>
                      <PaymentMethodsSummary charge={selectedCharge} />
                      
                      {/* Detalhes individuais dos splits */}
                      {selectedCharge.splits && selectedCharge.splits.length > 0 && (
                        <div className="space-y-2 mt-3">
                          {selectedCharge.splits.map((split) => (
                            <div key={split.id} className="p-3 bg-ds-bg-surface-alt rounded-lg border border-ds-border-subtle">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm">
                                  {split.method === 'pix' ? '💳 PIX' : '💳 Cartão de Crédito'}
                                </span>
                                <Badge variant={
                                  split.status === 'concluded' || split.pix_paid_at || split.pre_payment_key ? 'success' : 'warning'
                                }>
                                  {split.status === 'concluded' || split.pix_paid_at || split.pre_payment_key ? '✓ Pago' : '⏳ Pendente'}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-ds-text-muted">
                                <div>
                                  <span className="font-medium">Valor:</span> {formatCurrency(split.amount_cents)}
                                </div>
                                {split.installments && split.installments > 1 && (
                                  <div>
                                    <span className="font-medium">Parcelas:</span> {split.installments}x
                                  </div>
                                )}
                                {split.pre_payment_key && (
                                  <div className="col-span-2">
                                    <span className="font-medium">PreAuth:</span> {split.pre_payment_key.slice(0, 8)}...
                                  </div>
                                )}
                                {split.pix_paid_at && (
                                  <div className="col-span-2">
                                    <span className="font-medium">Pago em:</span> {format(new Date(split.pix_paid_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedCharge.description && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-ds-text-strong">Descrição</h4>
                      <p className="text-sm text-ds-text-muted">{selectedCharge.description}</p>
                    </div>
                  )}

                  <ChargeRefundTimeline chargeId={selectedCharge.id} hasBoletoLink={selectedCharge.has_boleto_link} />
                  <ChargeExecutions chargeId={selectedCharge.id} />
                </div>
                <SheetFooter>
                  <Button variant="outline" onClick={() => setSelectedCharge(null)}>
                    Fechar
                  </Button>
                </SheetFooter>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Executions Dialog */}
        <ExecutionsDialogContent 
          executionsDialog={executionsDialog}
          setExecutionsDialog={setExecutionsDialog}
          openPaymentLink={openPaymentLink}
          copyToClipboard={copyToClipboard}
        />

        {/* Checkout Success Modal */}
        {showCheckoutModal && checkoutModalData && (
          <CheckoutSuccessModal
            open={showCheckoutModal}
            onOpenChange={(open) => {
              setShowCheckoutModal(open);
              if (!open) setCheckoutModalData(null);
            }}
            checkoutData={{
              chargeId: checkoutModalData.chargeId,
              checkoutUrl: checkoutModalData.checkoutUrl,
              amount: checkoutModalData.amount,
              payerName: checkoutModalData.payerName,
              description: checkoutModalData.description,
              status: 'PENDENTE'
            }}
          />
        )}
      </div>
    </DashboardShell>
  );
}
