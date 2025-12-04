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
import { Loader2, Eye, RefreshCw, ExternalLink, Copy, Plus, List, Link2, User, Mail, Phone, Calendar as CalendarIcon, CreditCard, FileText, Filter, X, Search, AlertCircle, Info, ArrowLeft } from 'lucide-react';
import { useChargeLinks } from '@/hooks/useChargeLinks';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Layout } from '@/components/Layout';
import { ptBR } from 'date-fns/locale';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

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
  fee_amount?: number;
  fee_percentage?: number;
  executions: Array<{
    id: string;
    execution_date: string;
    status: string;
    payment_link_url: string | null;
  }>;
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
    pending: { 
      label: 'Pendente', 
      className: 'bg-transparent text-green-600 border-green-500 border'
    },
    processing: { 
      label: 'Processando', 
      className: 'bg-blue-500/10 text-blue-600 border-blue-500 border'
    },
    completed: { 
      label: 'Concluída', 
      className: 'bg-green-500/10 text-green-600 border-green-500/20'
    },
    failed: { 
      label: 'Falhou', 
      className: 'bg-red-500/10 text-red-600 border-red-500/20'
    },
    cancelled: { 
      label: 'Cancelada', 
      className: 'bg-gray-100 text-gray-600 border-gray-200'
    },
  };
  
  const config = configs[status as keyof typeof configs] || configs.cancelled;
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium text-xs", config.className)}>
      {config.label}
    </Badge>
  );
};

const getPaymentMethodBadgeStyle = (method: string) => {
  const styles = {
    cartao: 'bg-transparent text-blue-600 border-blue-500 border',
    pix: 'bg-transparent text-green-600 border-green-500 border',
    boleto: 'bg-transparent text-amber-600 border-amber-500 border',
  };
  return styles[method as keyof typeof styles] || styles.cartao;
};

const getPaymentMethodLabel = (method: string) => {
  const labels = { 
    cartao: 'Cartão', 
    pix: 'PIX', 
    boleto: 'Boleto' 
  };
  return labels[method as keyof typeof labels] || 'Cartão';
};

const getPaymentMethodIcon = (method: string) => {
  if (method === 'pix') return <span className="text-xs">📱</span>;
  if (method === 'boleto') return <FileText className="h-3 w-3" />;
  return <CreditCard className="h-3 w-3" />;
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
    default: 'bg-muted/30 border-border/50',
    primary: 'bg-gradient-to-br from-primary/5 to-primary/[0.02] border-primary/10',
    success: 'bg-green-500/5 border-green-500/10',
    info: 'bg-blue-500/5 border-blue-500/10',
  };
  
  const iconVariants = {
    default: 'bg-background text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-500/10 text-green-600',
    info: 'bg-blue-500/10 text-blue-600',
  };

  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-xl border", variants[variant])}>
      <div className={cn("p-2.5 rounded-lg", iconVariants[variant])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className="text-base font-semibold truncate">{value}</p>
        {subvalue && (
          <p className="text-xs text-muted-foreground mt-0.5">{subvalue}</p>
        )}
      </div>
    </div>
  );
};

// Skeleton Component
const ChargeCardSkeleton = () => (
  <Card className="overflow-hidden rounded-2xl">
    <CardHeader className="pb-4 bg-muted/30">
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
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
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
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : executionsQuery.data && executionsQuery.data.length > 0 ? (
            <div className="space-y-2">
              {executionsQuery.data.map((execution: any) => (
                <div key={execution.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getModernStatusBadge(execution.status)}
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
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCharges(data as Charge[]);
      setFilteredCharges(data as Charge[]);
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
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
              className="bg-primary hover:bg-primary/90 gap-2"
              disabled={isGenerating || isCompleted}
            >
              <Plus className="h-4 w-4" />
              Gerar Link
            </Button>
          </div>
        </div>
      );
    }

    const checkoutUrl = linkQuery.data.url;

    return (
      <div className="space-y-3">
        {isCompleted && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Info className="h-4 w-4" />
            <span>Pagamento já concluído</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            onClick={() => openPaymentLink(checkoutUrl)}
            disabled={isCompleted}
          >
            <ExternalLink className="h-4 w-4" />
            Abrir Link
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              copyToClipboard(checkoutUrl);
              toast({
                title: "✓ Link copiado!",
                description: "O link de pagamento foi copiado para a área de transferência",
                duration: 3000,
              });
            }}
            disabled={isCompleted}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleGenerateLink}
            disabled={isGenerating || isCompleted}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Abrir Modal
          </Button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (isOperador) {
      fetchCharges();
    }

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

  useEffect(() => {
    applyFilters();
  }, [filters, charges]);

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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Histórico de Cobranças</h1>
            <Badge className="bg-green-500 hover:bg-green-500 text-white text-xs px-2 py-0.5">
              {charges.length} cobranças
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Gerencie as cobranças criadas e acompanhe seus status, links de pagamento e ações.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => setShowFilters(!showFilters)} 
            variant="outline"
            size="sm"
            className="gap-2 h-9"
          >
            <Filter className="h-4 w-4" />
            <span>Filtros</span>
            {hasActiveFilters() && (
              <Badge className="ml-1 h-5 min-w-[20px] rounded-full bg-green-500 text-white text-xs">
                {Object.values(filters).filter(v => v && v !== 'all' && v !== '').length}
              </Badge>
            )}
          </Button>
          <Button onClick={fetchCharges} variant="outline" size="sm" className="gap-2 h-9">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters() && (
        <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl bg-muted/30 border border-border/50">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Filtros ativos:
          </span>
          
          {filters.status !== 'all' && (
            <Badge variant="secondary" className="gap-1.5">
              Status: {filters.status}
              <button 
                onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.recurrence_type !== 'all' && (
            <Badge variant="secondary" className="gap-1.5">
              Tipo: {getRecurrenceLabel(filters.recurrence_type)}
              <button 
                onClick={() => setFilters(prev => ({ ...prev, recurrence_type: 'all' }))}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.date_from && (
            <Badge variant="secondary" className="gap-1.5">
              De: {format(filters.date_from, 'dd/MM/yy', { locale: ptBR })}
              <button 
                onClick={() => setFilters(prev => ({ ...prev, date_from: undefined }))}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.date_to && (
            <Badge variant="secondary" className="gap-1.5">
              Até: {format(filters.date_to, 'dd/MM/yy', { locale: ptBR })}
              <button 
                onClick={() => setFilters(prev => ({ ...prev, date_to: undefined }))}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.payer_document && (
            <Badge variant="secondary" className="gap-1.5">
              CPF: {filters.payer_document}
              <button 
                onClick={() => setFilters(prev => ({ ...prev, payer_document: '' }))}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          <Button 
            onClick={clearFilters} 
            size="sm" 
            variant="ghost" 
            className="ml-auto h-7 text-xs gap-1"
          >
            <X className="h-3 w-3" />
            Limpar Tudo
          </Button>
        </div>
      )}

      {/* Filters Section */}
      {showFilters && (
        <Card className="border-primary/20 bg-muted/30">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros de Busca
              </CardTitle>
              {hasActiveFilters() && (
                <Button onClick={clearFilters} variant="ghost" size="sm">
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select 
                  value={filters.status} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="processing">Processando</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="failed">Falhou</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Recurrence Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select 
                  value={filters.recurrence_type} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, recurrence_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pontual">Pontual</SelectItem>
                    <SelectItem value="diaria">Diária</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date From Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data inicial</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.date_from ? format(filters.date_from, 'dd/MM/yyyy', { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filters.date_from}
                      onSelect={(date) => setFilters(prev => ({ ...prev, date_from: date }))}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data final</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.date_to ? format(filters.date_to, 'dd/MM/yyyy', { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filters.date_to}
                      onSelect={(date) => setFilters(prev => ({ ...prev, date_to: date }))}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* CPF Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">CPF do Cliente</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Digite o CPF..."
                    value={filters.payer_document}
                    onChange={(e) => setFilters(prev => ({ ...prev, payer_document: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charges List */}
      {loading ? (
        <div className="grid gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <ChargeCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredCharges.map((charge) => (
            <Card key={charge.id} className="overflow-hidden rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md bg-card">
              {/* Card Header */}
              <CardHeader className="pb-3 pt-4 px-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  {/* Avatar + Cliente */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar className="h-11 w-11 border border-teal-200">
                      <AvatarFallback className="bg-teal-500/10 text-teal-600 text-sm font-semibold">
                        {getInitials(charge.payer_name)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-foreground truncate">
                        {charge.payer_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mt-1">
                        <a href={`mailto:${charge.payer_email}`} className="text-blue-600 hover:underline truncate">
                          {charge.payer_email}
                        </a>
                        {charge.payer_phone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{formatPhone(charge.payer_phone)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 lg:flex-shrink-0">
                    {getModernStatusBadge(charge.status)}
                    <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-200">
                      {getRecurrenceLabel(charge.recurrence_type)}
                    </Badge>
                    {charge.payment_method && (
                      <Badge variant="outline" className={cn("text-xs", getPaymentMethodBadgeStyle(charge.payment_method))}>
                        {getPaymentMethodLabel(charge.payment_method)}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              {/* Card Content */}
              <CardContent className="px-5 pb-4 space-y-4">
                {/* Info Horizontal - 3 Columns */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-3 border-y border-border/50">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">VALOR TOTAL</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(charge.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">CRIADO EM</p>
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(charge.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">DESCRIÇÃO</p>
                    <p className="text-sm text-foreground truncate">{charge.description || '—'}</p>
                  </div>
                </div>

                {/* Área de Link de Pagamento */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground">Link de Pagamento</span>
                    <CheckoutButtons charge={charge} />
                  </div>
                </div>

                {/* Card Footer - Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <button
                    onClick={() => setSelectedCharge(charge)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    Ver detalhes
                  </button>
                  
                  <div className="flex items-center gap-2">
                    {charge.recurrence_type !== 'pontual' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewExecutions(charge.id, charge.payer_name)}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <List className="h-3.5 w-3.5" />
                        Execuções
                      </Button>
                    )}
                    {charge.status === 'pending' && (
                      <Button 
                        size="sm" 
                        onClick={() => processCharge(charge.id)}
                        className="gap-1.5 h-8 text-xs bg-gradient-to-r from-green-500 to-yellow-400 hover:from-green-600 hover:to-yellow-500 text-white border-0"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Processar agora
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Empty States */}
          {filteredCharges.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                {charges.length === 0 ? (
                  <>
                    <div className="p-4 rounded-full bg-muted/50 mb-4">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Nenhuma cobrança criada</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                      Comece criando sua primeira cobrança para gerenciar pagamentos
                    </p>
                    <Button className="bg-primary hover:bg-primary/90" asChild>
                      <Link to="/new-charge">
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Primeira Cobrança
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-full bg-muted/50 mb-4">
                      <Search className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Nenhum resultado encontrado</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                      Nenhuma cobrança corresponde aos filtros aplicados. Tente ajustar os critérios de busca.
                    </p>
                    <Button onClick={clearFilters} variant="outline" className="gap-2">
                      <X className="h-4 w-4" />
                      Limpar Filtros
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Sheet de Detalhes */}
      <Sheet open={!!selectedCharge} onOpenChange={(open) => !open && setSelectedCharge(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="pb-6 border-b">
            <SheetTitle className="text-2xl">Detalhes da Cobrança</SheetTitle>
            <SheetDescription className="text-base">
              Informações completas e histórico de execuções
            </SheetDescription>
          </SheetHeader>

          {selectedCharge && (
            <div className="py-6 space-y-6">
              {/* Seção 1: Info Cliente */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Dados do Pagador
                </h4>
                <div className="p-4 rounded-xl bg-muted/30 border space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(selectedCharge.payer_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-lg">{selectedCharge.payer_name}</p>
                      <div className="space-y-1.5 mt-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{selectedCharge.payer_email}</span>
                        </div>
                        {selectedCharge.payer_phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{formatPhone(selectedCharge.payer_phone)}</span>
                          </div>
                        )}
                        {selectedCharge.payer_document && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" />
                            <span>CPF: {selectedCharge.payer_document}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 2: Info Financeira */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Informações Financeiras
                </h4>
                <div className="p-5 rounded-xl bg-gradient-to-br from-primary/5 to-primary/[0.02] border border-primary/10">
                  {selectedCharge.payment_method === 'pix' && selectedCharge.fee_amount && selectedCharge.fee_amount > 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground mb-1">Valor Total</p>
                      <p className="text-3xl font-bold text-primary">{formatCurrency(selectedCharge.amount)}</p>
                      
                      <div className="mt-4 pt-4 border-t border-primary/10 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Valor Original:</span>
                          <span className="font-semibold">{formatCurrency(selectedCharge.amount - selectedCharge.fee_amount)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Taxa PIX (3%):</span>
                          <span className="font-semibold text-amber-600">+ {formatCurrency(selectedCharge.fee_amount)}</span>
                        </div>
                        <div className="flex justify-between items-center text-base pt-2 border-t border-primary/10">
                          <span className="font-semibold">Valor Total:</span>
                          <span className="font-bold text-primary">{formatCurrency(selectedCharge.amount)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground mb-1">Valor Total</p>
                      <p className="text-3xl font-bold text-primary">{formatCurrency(selectedCharge.amount)}</p>
                    </>
                  )}
                  
                  {selectedCharge.description && (
                    <div className="mt-4 pt-4 border-t border-primary/10">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Descrição</p>
                      <p className="text-sm leading-relaxed">{selectedCharge.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção 3: Datas e Configuração */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Datas e Configuração
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 border">
                    <p className="text-xs text-muted-foreground mb-1">Criado em</p>
                    <p className="text-sm font-semibold">
                      {format(new Date(selectedCharge.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-muted/30 border">
                    <p className="text-xs text-muted-foreground mb-1">Tipo</p>
                    <p className="text-sm font-semibold">
                      {getRecurrenceLabel(selectedCharge.recurrence_type)}
                    </p>
                  </div>
                  
                  {selectedCharge.next_charge_date && (
                    <div className="col-span-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                      <p className="text-xs text-muted-foreground mb-1">Próxima Cobrança</p>
                      <p className="text-sm font-semibold text-blue-600">
                        {format(new Date(selectedCharge.next_charge_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção 4: Status e Link */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Status e Link de Pagamento
                </h4>
                <div className="p-4 rounded-xl bg-muted/30 border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status Atual:</span>
                    {getModernStatusBadge(selectedCharge.status)}
                  </div>
                  
                  <div className="pt-3 border-t">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Link de Pagamento</p>
                    <CheckoutButtons charge={selectedCharge} />
                  </div>
                </div>
              </div>

              {/* Seção 5: Timeline de Execuções */}
              {selectedCharge.recurrence_type !== 'pontual' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Histórico de Execuções
                  </h4>
                  <ChargeExecutions chargeId={selectedCharge.id} />
                </div>
              )}

              {/* Seção 6: Timeline de Refunds */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Histórico de Estornos
                </h4>
                <ChargeRefundTimeline chargeId={selectedCharge.id} hasBoletoLink={selectedCharge.has_boleto_link} />
              </div>
            </div>
          )}

          <SheetFooter className="pt-6 border-t mt-6">
            <Button 
              variant="outline" 
              onClick={() => setSelectedCharge(null)}
              className="w-full"
            >
              Fechar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Executions Dialog */}
      <ExecutionsDialogContent
        executionsDialog={executionsDialog}
        setExecutionsDialog={setExecutionsDialog}
        openPaymentLink={openPaymentLink}
        copyToClipboard={copyToClipboard}
      />

      {/* Checkout Modal */}
      {showCheckoutModal && checkoutModalData && (
        <CheckoutSuccessModal
          open={showCheckoutModal}
          onOpenChange={setShowCheckoutModal}
          checkoutData={checkoutModalData}
        />
      )}
    </div>
  );
}
