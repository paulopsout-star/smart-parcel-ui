import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Loader2, Eye, RefreshCw, ExternalLink, Copy, Plus, List, Link2, User, Mail, Phone, Calendar as CalendarIcon, CreditCard, FileText, Filter, X, Search, AlertCircle, Info, ArrowLeft, QrCode, Wallet, TrendingUp, Percent, Building2, Download, FileSpreadsheet, Clock } from 'lucide-react';
import { useChargeLinks } from '@/hooks/useChargeLinks';
import { toast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ptBR } from 'date-fns/locale';

// Intervalo de sincronização automática: 5 minutos
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

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
  display_amount_cents?: number;
  status: string;
  pix_paid_at?: string;
  pre_payment_key?: string;
  transaction_id?: string;
  processed_at?: string;
  order_index: number;
  installments?: number;
}

interface Company {
  id: string;
  name: string;
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
  boleto_admin_linha_digitavel?: string; // Nova coluna para linha digitável do admin
  creditor_document?: string;
  creditor_name?: string;
  company_id?: string;
  company?: Company;
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
  payment_method: string;
  date_from: Date | undefined;
  date_to: Date | undefined;
  payer_document: string;
  company_id: string;
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

const formatDocument = (doc: string | null | undefined) => {
  if (!doc) return '-';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
};

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
};

// Função para calcular status computado baseado nos splits (para pagamentos combinados)
const getComputedStatus = (charge: Charge): string => {
  // Se não for pagamento combinado ou não tem splits, usar status do charge
  if (charge.payment_method !== 'cartao_pix' || !charge.splits || charge.splits.length === 0) {
    return charge.status;
  }

  const pixSplit = charge.splits.find(s => s.method === 'pix');
  const cardSplit = charge.splits.find(s => s.method === 'credit_card');

  // Verificar se cada split está pago - ÚNICA fonte de verdade: status === 'concluded'
  const pixPaid = pixSplit && (pixSplit.status === 'concluded' || pixSplit.pix_paid_at);
  // Para cartão: SOMENTE status === 'concluded' indica pagamento aprovado (não pre_payment_key)
  const cardPaid = cardSplit && cardSplit.status === 'concluded';

  // Ambos pagos → completed
  if (pixPaid && cardPaid) {
    return 'completed';
  }

  // Apenas um pago → partial
  if (pixPaid || cardPaid) {
    return 'partial';
  }

  // Nenhum pago → manter status original
  return charge.status;
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
    // NOVO: Status parcial para pagamentos combinados
    partial: {
      label: 'Parcialmente Pago',
      variant: 'warning' as const
    },
    // NOVO: StatusCode 50 - CNPJ não cadastrado
    cnpj_nao_cadastrado: {
      label: 'CNPJ não cadastrado',
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
const PaymentMethodsSummary = ({ charge, isAdmin }: { charge: Charge; isAdmin: boolean }) => {
  const splits = charge.splits || [];
  
  const pixSplit = splits.find(s => s.method === 'pix');
  const cardSplit = splits.find(s => s.method === 'credit_card');

  // Cálculos para PIX - sempre calcular 5% de taxa
  const pixBase = charge.pix_amount || 0;
  const PIX_FEE_RATE = 0.05; // 5%
  const pixFeeCalculated = Math.round(pixBase * PIX_FEE_RATE);
  // Se há split, usar o valor real; senão, calcular com taxa de 5%
  const pixTotal = pixSplit?.amount_cents || (pixBase + pixFeeCalculated);
  const pixFee = pixTotal - pixBase;
  const pixFeePercent = pixBase > 0 
    ? ((pixFee / pixBase) * 100).toFixed(1) 
    : '5.0';

  // Cálculos para Cartão - usar valor do split se disponível
  // Para pagamentos 100% cartão, usar charge.amount como base quando card_amount for null
  const cardBase = charge.card_amount || (charge.payment_method === 'cartao' ? charge.amount : 0);
  const cardTotalWithInterest = cardSplit?.display_amount_cents || cardSplit?.amount_cents || cardBase;
  const cardTotal = isAdmin ? cardTotalWithInterest : cardBase;
  const cardFeeAmount = cardTotalWithInterest - cardBase;
  const cardFee = isAdmin ? cardFeeAmount : 0;
  const cardFeePercent = cardBase > 0 && cardFeeAmount > 0 
    ? ((cardFeeAmount / cardBase) * 100).toFixed(1) 
    : '0';

  // Verificar se o split está pago - ÚNICA fonte de verdade: status === 'concluded'
  const isSplitPaid = (split: PaymentSplitInfo | undefined, isPix: boolean): boolean => {
    if (!split) return false;
    // Para PIX, pix_paid_at também indica conclusão (webhook processado)
    if (isPix) {
      return split.status === 'concluded' || !!split.pix_paid_at;
    }
    // Para cartão: SOMENTE status === 'concluded' indica pagamento aprovado
    return split.status === 'concluded';
  };

  const getSplitStatusBadge = (split: PaymentSplitInfo | undefined, isPix: boolean) => {
    if (!split) return null;
    if (isSplitPaid(split, isPix)) {
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
                <span>Valor original:</span>
                <span>{formatCurrency(pixBase)}</span>
              </div>
              {isAdmin && (
                <div className="flex justify-between text-green-600">
                  <span>Taxa PIX ({pixFeePercent}%):</span>
                  <span>{pixFee > 0 ? `+ ${formatCurrency(pixFee)}` : 'R$ 0,00'}</span>
                </div>
              )}
              <div className="border-t border-green-500/10 pt-1.5 mt-1.5">
                <div className={`flex justify-between font-semibold ${isSplitPaid(pixSplit, true) ? 'text-green-700' : 'text-amber-600'}`}>
                  <span>{isSplitPaid(pixSplit, true) ? 'Total pago:' : 'Valor:'}</span>
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
                <span>Valor original:</span>
                <span>{formatCurrency(cardBase)}</span>
              </div>
              {isAdmin && (
                <div className="flex justify-between text-blue-600">
                  <span>Juros {cardSplit?.installments && cardSplit.installments > 1 ? `(${cardSplit.installments}x)` : ''} ({cardFeePercent}%):</span>
                  <span>{cardFee > 0 ? `+ ${formatCurrency(cardFee)}` : 'R$ 0,00'}</span>
                </div>
              )}
              <div className="border-t border-blue-500/10 pt-1.5 mt-1.5">
                <div className={`flex justify-between font-semibold ${isSplitPaid(cardSplit, false) ? 'text-blue-700' : 'text-amber-600'}`}>
                  <span>{isSplitPaid(cardSplit, false) ? 'Total pago:' : 'Valor:'}</span>
                  <span>{formatCurrency(cardTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Total Geral - só somar o que foi efetivamente pago */}
      {hasPix && hasCard && (() => {
        const pixPaid = isSplitPaid(pixSplit, true);
        const cardPaid = isSplitPaid(cardSplit, false);
        const totalPaid = (pixPaid ? pixTotal : 0) + (cardPaid ? cardTotal : 0);
        const totalPending = (!pixPaid ? pixTotal : 0) + (!cardPaid ? cardTotal : 0);
        
        return (
          <div className="space-y-2">
            {totalPaid > 0 && (
              <div className="p-3 bg-green-500/5 rounded-card border border-green-500/20 flex justify-between items-center">
                <div className="flex items-center gap-2 text-green-700">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">Total pago pelo cliente:</span>
                </div>
                <span className="text-lg font-bold text-green-700">
                  {formatCurrency(totalPaid)}
                </span>
              </div>
            )}
            {totalPending > 0 && (
              <div className="p-3 bg-amber-500/5 rounded-card border border-amber-500/20 flex justify-between items-center">
                <div className="flex items-center gap-2 text-amber-700">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">Valor pendente:</span>
                </div>
                <span className="text-lg font-bold text-amber-700">
                  {formatCurrency(totalPending)}
                </span>
              </div>
            )}
          </div>
        );
      })()}
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
  const { isOperador, isAdmin } = useAuth();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [filteredCharges, setFilteredCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null);
  const [executionsDialog, setExecutionsDialog] = useState<{ open: boolean; chargeId: string; chargeName: string }>({
    open: false,
    chargeId: '',
    chargeName: ''
  });
  
  // Companies list for admin filter
  const [companies, setCompanies] = useState<Company[]>([]);
  
  // Estado para vinculação manual de boleto (admin)
  const [adminLinhaDigitavel, setAdminLinhaDigitavel] = useState('');
  const [linkingBoleto, setLinkingBoleto] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<ChargeFilters>({
    status: 'all',
    payment_method: 'all',
    date_from: undefined,
    date_to: undefined,
    payer_document: '',
    company_id: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Checkout modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutModalData, setCheckoutModalData] = useState<any>(null);
  
  // Estado para última sincronização
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const autoSyncRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    copyToClipboard,
    openPaymentLink
  } = useChargeLinks();

  const fetchCompanies = async () => {
    if (!isAdmin) return;
    
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setCompanies(data);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  // Função de sincronização com API Cappta (manual ou automática)
  const syncPaymentStatuses = useCallback(async (isAutoSync = false) => {
    setSyncing(true);
    try {
      // Sincronizar status de pagamentos Quita+/Boleto
      const { data, error } = await supabase.functions.invoke('sync-payment-status');
      
      // Sincronizar status de PIX
      const { data: pixData, error: pixError } = await supabase.functions.invoke('sync-pix-status');
      
      // Sincronizar status de Cartão (verifica API Quita+ para pagamentos pendentes/inconsistentes)
      const { data: cardData, error: cardError } = await supabase.functions.invoke('sync-card-status');
      
      const allFailed = error && pixError && cardError;
      
      if (allFailed) {
        console.error('Erro na sincronização:', { error, pixError, cardError });
        if (!isAutoSync) {
          toast({
            title: "Erro na sincronização",
            description: "Não foi possível sincronizar com o gateway. Os dados locais serão exibidos.",
            variant: "destructive",
          });
        }
      } else {
        const updated = (data?.updated || 0) + (pixData?.stats?.updated || 0) + (cardData?.stats?.updated || 0);
        const processed = (data?.processed || 0) + (pixData?.stats?.checked || 0) + (cardData?.stats?.checked || 0);
        
        // Atualizar timestamp da última sincronização
        setLastSync(new Date());
        
        // Mostrar toast apenas para sincronização manual ou se houve atualizações
        if (!isAutoSync) {
          if (updated > 0) {
            toast({
              title: "Sincronização concluída",
              description: `${updated} cobrança(s) atualizada(s).`,
            });
          } else {
            toast({
              title: "Sincronização concluída",
              description: `${processed} cobrança(s) verificada(s). Nenhuma atualização necessária.`,
            });
          }
        } else if (updated > 0) {
          // Para auto-sync, mostrar toast apenas se houve atualizações
          toast({
            title: "Atualização automática",
            description: `${updated} cobrança(s) atualizada(s) (inclui PIX e Cartão).`,
          });
        }
        
        console.log(`[ChargeHistory] Sincronização ${isAutoSync ? 'automática' : 'manual'}: ${updated}/${processed} atualizados (Boleto: ${data?.updated || 0}, PIX: ${pixData?.stats?.updated || 0}, Cartão: ${cardData?.stats?.updated || 0})`);
      }
    } catch (err) {
      console.error('Erro ao sincronizar:', err);
      if (!isAutoSync) {
        toast({
          title: "Erro",
          description: "Falha na comunicação com o servidor.",
          variant: "destructive",
        });
      }
    } finally {
      setSyncing(false);
      await fetchCharges();
    }
  }, []);

  // Verificar se há cobranças pendentes que precisam de sincronização
  const hasPendingCharges = useCallback(() => {
    const pendingStatuses = ['pending', 'pre_authorized', 'processing', 'validating', 'boleto_linked', 'awaiting_validation'];
    return charges.some(c => pendingStatuses.includes(c.status));
  }, [charges]);

  const fetchCharges = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('charges')
        .select(`
          *,
          company:companies(id, name),
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
            display_amount_cents,
            status,
            pix_paid_at,
            pre_payment_key,
            transaction_id,
            processed_at,
            order_index,
            installments,
            created_at
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

    if (filters.payment_method !== 'all') {
      filtered = filtered.filter(charge => charge.payment_method === filters.payment_method);
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

    // Company filter (admin only)
    if (isAdmin && filters.company_id !== 'all') {
      filtered = filtered.filter(charge => charge.company_id === filters.company_id);
    }

    setFilteredCharges(filtered);
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      payment_method: 'all',
      date_from: undefined,
      date_to: undefined,
      payer_document: '',
      company_id: 'all'
    });
    setFilteredCharges(charges);
  };

  const hasActiveFilters = () => {
    return filters.status !== 'all' || 
           filters.payment_method !== 'all' || 
           filters.date_from !== undefined || 
           filters.date_to !== undefined || 
           filters.payer_document !== '' ||
           (isAdmin && filters.company_id !== 'all');
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

  // Função para admin vincular boleto manualmente
  const handleAdminLinkBoleto = async (charge: Charge) => {
    if (!adminLinhaDigitavel.trim()) {
      toast({
        title: "Erro",
        description: "Informe a linha digitável do boleto.",
        variant: "destructive",
      });
      return;
    }

    const sanitized = adminLinhaDigitavel.replace(/\D/g, '');
    if (sanitized.length < 47 || sanitized.length > 48) {
      toast({
        title: "Linha digitável inválida",
        description: "A linha digitável deve ter 47 ou 48 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setLinkingBoleto(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-link-boleto', {
        body: {
          chargeId: charge.id,
          linhaDigitavel: sanitized,
        },
      });

      if (error || !data?.success) {
        const errorMsg = error?.message || data?.error || 'Erro desconhecido';
        toast({
          title: "Erro ao vincular boleto",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✓ Boleto vinculado!",
        description: "O boleto foi vinculado com sucesso ao pagamento.",
      });

      setAdminLinhaDigitavel('');
      setSelectedCharge(null);
      await fetchCharges();
    } catch (err) {
      console.error('Erro ao vincular boleto:', err);
      toast({
        title: "Erro inesperado",
        description: "Falha ao vincular boleto. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLinkingBoleto(false);
    }
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
    fetchCompanies();
    
    const handleOpenCheckoutModal = (event: CustomEvent) => {
      setCheckoutModalData(event.detail);
      setShowCheckoutModal(true);
    };
    
    window.addEventListener('openCheckoutModal', handleOpenCheckoutModal as EventListener);
    return () => window.removeEventListener('openCheckoutModal', handleOpenCheckoutModal as EventListener);
  }, [isAdmin]);

  // Polling automático: sincronizar a cada 5 minutos se houver cobranças pendentes
  useEffect(() => {
    // Sincronização inicial ao carregar a página (se houver cobranças pendentes)
    const initialSyncTimeout = setTimeout(() => {
      if (hasPendingCharges() && !syncing) {
        console.log('[ChargeHistory] Sincronização inicial...');
        syncPaymentStatuses(true);
      }
    }, 2000); // Aguardar 2s para garantir que charges foram carregados

    // Configurar intervalo de sincronização automática
    autoSyncRef.current = setInterval(() => {
      if (hasPendingCharges() && !syncing) {
        console.log('[ChargeHistory] Sincronização automática (5 min)...');
        syncPaymentStatuses(true);
      }
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      clearTimeout(initialSyncTimeout);
      if (autoSyncRef.current) {
        clearInterval(autoSyncRef.current);
      }
    };
  }, [hasPendingCharges, syncing, syncPaymentStatuses]);

  useEffect(() => {
    applyFilters();
  }, [filters, charges]);

  // Export helper functions
  const getPaymentMethodLabel = (method: string | undefined) => {
    switch (method) {
      case 'cartao': return 'Cartão';
      case 'pix': return 'PIX';
      case 'cartao_pix': return 'PIX + Cartão';
      default: return method || '-';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendente',
      processing: 'Processando',
      completed: 'Concluído',
      failed: 'Falhou',
      cancelled: 'Cancelado',
      pre_authorized: 'Pré-autorizado',
      boleto_linked: 'Boleto Vinculado',
      approved: 'Aprovado',
      awaiting_validation: 'Aguardando Validação',
      validating: 'Validando',
      payment_denied: 'Pagamento Negado'
    };
    return labels[status] || status;
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateExportData = () => {
    const headers = [
      'ID', 'Data Criação', 'Pagador', 'Email', 'Telefone', 'CPF/CNPJ',
      'Valor (R$)', 'Descrição', 'Método Pagamento', 'Status', 'Empresa'
    ];

    const rows = filteredCharges.map(charge => [
      charge.id,
      format(new Date(charge.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      charge.payer_name,
      charge.payer_email,
      formatPhone(charge.payer_phone),
      charge.payer_document,
      (charge.amount / 100).toFixed(2).replace('.', ','),
      charge.description || '',
      getPaymentMethodLabel(charge.payment_method),
      getStatusLabel(charge.status),
      charge.company?.name || ''
    ]);

    return { headers, rows };
  };

  const exportToCSV = () => {
    const { headers, rows } = generateExportData();
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
    downloadFile('\uFEFF' + csvContent, `cobrancas_${timestamp}.csv`, 'text/csv;charset=utf-8');
    toast({ title: 'Exportação concluída', description: `${filteredCharges.length} cobranças exportadas para CSV` });
  };

  const exportToExcel = () => {
    const { headers, rows } = generateExportData();
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join('\t'))
      .join('\n');
    
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
    downloadFile('\uFEFF' + csvContent, `cobrancas_${timestamp}.xls`, 'application/vnd.ms-excel;charset=utf-8');
    toast({ title: 'Exportação concluída', description: `${filteredCharges.length} cobranças exportadas para Excel` });
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ds-text-strong">Histórico de Cobranças</h1>
              <div className="flex items-center gap-3">
                <p className="text-ds-text-muted">Gerencie e acompanhe todas as suas cobranças</p>
                {lastSync && (
                  <span className="text-xs text-ds-text-muted flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Última sync: {formatDistanceToNow(lastSync, { locale: ptBR, addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
            {isAdmin && (
              <Badge variant="info" className="gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Todas as Empresas
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {hasActiveFilters() && (
                <Badge variant="default" className="ml-2">!</Badge>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={exportToCSV}
              disabled={filteredCharges.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button 
              variant="outline" 
              onClick={exportToExcel}
              disabled={filteredCharges.length === 0}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button onClick={() => syncPaymentStatuses(false)} variant="outline" disabled={loading || syncing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${(loading || syncing) ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Atualizar'}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* Company filter - Admin only */}
                {isAdmin && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ds-text-muted">Empresa</label>
                    <Select value={filters.company_id} onValueChange={(value) => setFilters(prev => ({ ...prev, company_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as empresas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as empresas</SelectItem>
                        {companies.map(company => (
                          <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                  <label className="text-sm font-medium text-ds-text-muted">Tipo de Pagamento</label>
                  <Select value={filters.payment_method} onValueChange={(value) => setFilters(prev => ({ ...prev, payment_method: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao_pix">PIX + Cartão</SelectItem>
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
                        <p className="text-xs text-ds-text-muted">{formatDocument(charge.payer_document)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isAdmin && charge.company && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Building2 className="h-3 w-3" />
                          {charge.company.name}
                        </Badge>
                      )}
                      {getModernStatusBadge(getComputedStatus(charge))}
                      {charge.payment_method && getPaymentMethodBadge(charge.payment_method)}
                      {/* Status do vínculo de boleto para pagamentos combinados */}
                      {charge.payment_method === 'cartao_pix' && charge.pre_payment_key && (
                        <Badge variant={charge.boleto_admin_linha_digitavel ? 'success' : 'warning'} className="gap-1 text-xs">
                          <Link2 className="h-3 w-3" />
                          {charge.boleto_admin_linha_digitavel ? 'Boleto Vinculado' : 'Aguardando Vínculo'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
                      icon={User}
                      label="CPF/CNPJ"
                      value={formatDocument(charge.payer_document)}
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
                      <PaymentMethodsSummary charge={charge} isAdmin={isAdmin} />
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
                    <InfoCard icon={FileText} label="CPF/CNPJ" value={formatDocument(selectedCharge.payer_document)} />
                    <InfoCard icon={CreditCard} label="Valor" value={formatCurrency(selectedCharge.amount)} variant="primary" />
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-ds-text-strong">Status</h4>
                    <div className="flex gap-2">
                      {getModernStatusBadge(getComputedStatus(selectedCharge))}
                      <Badge variant="outline">{selectedCharge.recurrence_type}</Badge>
                      {selectedCharge.payment_method && getPaymentMethodBadge(selectedCharge.payment_method)}
                    </div>
                  </div>

                  {/* Métodos de Pagamento Detalhados */}
                  {(selectedCharge.payment_method === 'cartao_pix' || (selectedCharge.splits && selectedCharge.splits.length > 0)) && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-ds-text-strong">Métodos de Pagamento</h4>
                      <PaymentMethodsSummary charge={selectedCharge} isAdmin={isAdmin} />
                      
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
                                  split.status === 'concluded' || (split.method === 'pix' && split.pix_paid_at) ? 'success' : 
                                  split.status === 'failed' ? 'destructive' : 'warning'
                                }>
                                  {split.status === 'concluded' || (split.method === 'pix' && split.pix_paid_at) ? '✓ Pago' : 
                                   split.status === 'failed' ? '✗ Recusado' : '⏳ Pendente'}
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

                  {/* ADMIN: Exibir linha digitável para TODOS os tipos de pagamento */}
                  {isAdmin && selectedCharge.boleto_linha_digitavel && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-ds-text-strong flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Linha Digitável {selectedCharge.payment_method === 'cartao_pix' ? '(Cadastro)' : ''}
                      </h4>
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs break-all text-amber-800 dark:text-amber-200 flex-1">
                            {selectedCharge.boleto_linha_digitavel}
                          </code>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(selectedCharge.boleto_linha_digitavel!)}
                            className="shrink-0"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-amber-600 dark:text-amber-300 mt-1 flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          {selectedCharge.payment_method === 'cartao_pix' 
                            ? 'Linha do cadastro - pode diferir do boleto vinculado'
                            : selectedCharge.payment_method === 'cartao'
                            ? 'Boleto original utilizado para o pagamento com cartão'
                            : selectedCharge.payment_method === 'pix'
                            ? 'Apenas para referência - sem vinculação automática'
                            : selectedCharge.payment_method === 'boleto'
                            ? 'Boleto emitido para pagamento'
                            : 'Linha digitável do boleto'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ADMIN: Campo para vincular boleto manualmente (pagamentos combinados) */}
                  {isAdmin && 
                   selectedCharge.payment_method === 'cartao_pix' &&
                   selectedCharge.pre_payment_key &&
                   !selectedCharge.boleto_admin_linha_digitavel && (
                    <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Vincular Boleto Manualmente
                      </h4>
                      <p className="text-xs text-blue-600 dark:text-blue-300">
                        Informe a linha digitável do boleto que será vinculado ao pagamento do cartão.
                      </p>
                      <Input
                        placeholder="Digite a linha digitável (47 ou 48 dígitos)"
                        value={adminLinhaDigitavel}
                        onChange={(e) => setAdminLinhaDigitavel(e.target.value)}
                        className="font-mono text-sm"
                      />
                      <Button 
                        onClick={() => handleAdminLinkBoleto(selectedCharge)}
                        disabled={adminLinhaDigitavel.replace(/\D/g, '').length < 47 || linkingBoleto}
                        className="w-full gap-2"
                      >
                        {linkingBoleto ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                        {linkingBoleto ? 'Vinculando...' : 'Vincular Boleto'}
                      </Button>
                    </div>
                  )}

                  {/* Status do vínculo manual (visível para todos) */}
                  {selectedCharge.payment_method === 'cartao_pix' && selectedCharge.boleto_admin_linha_digitavel && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-ds-text-strong flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Boleto Vinculado (Admin)
                      </h4>
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="success">✓ Vinculado</Badge>
                        </div>
                        {isAdmin && (
                          <code className="text-xs break-all text-green-800 dark:text-green-200">{selectedCharge.boleto_admin_linha_digitavel}</code>
                        )}
                      </div>
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
