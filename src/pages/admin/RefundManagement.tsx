import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Play, RefreshCw, Calendar, DollarSign, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RefundJob {
  id: string;
  charge_id: string;
  original_amount_cents: number;
  refund_amount_cents: number;
  fee_amount_cents: number;
  reason: string;
  scheduled_for: string;
  processed_at?: string;
  status: string;
  error_details?: any;
  created_at: string;
  charges: {
    payer_name: string;
    payer_email: string;
    description: string;
  };
}

interface SchedulerStats {
  charges_eligiveis: number;
  splits_refundados: number;
  jobs_criados: number;
  jobs_executados: number;
  errors: string[];
}

export default function RefundManagement() {
  const { isAdmin } = useAuth();
  const [jobs, setJobs] = useState<RefundJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [executingJob, setExecutingJob] = useState<string | null>(null);
  const [schedulerStats, setSchedulerStats] = useState<SchedulerStats | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chargeIdFilter, setChargeIdFilter] = useState('');

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: 'Pendente', variant: 'secondary' as const },
      processed: { label: 'Processado', variant: 'default' as const },
      failed: { label: 'Falhado', variant: 'destructive' as const },
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.pending;
  };

  const loadJobs = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (chargeIdFilter) params.set('chargeId', chargeIdFilter);
      params.set('limit', '100');

      const { data, error } = await supabase.functions.invoke('refunds-scheduler', {
        body: { 
          path: `/refunds/jobs?${params.toString()}`,
          method: 'GET'
        }
      });

      if (error) throw error;
      setJobs(data.jobs || []);
    } catch (error: any) {
      console.error('Error loading refund jobs:', error);
      toast({
        title: 'Erro ao carregar estornos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const runScheduler = async () => {
    try {
      setRunningScheduler(true);
      setSchedulerStats(null);
      
      const { data, error } = await supabase.functions.invoke('refunds-scheduler', {
        body: { 
          path: '/refunds/scheduler/run',
          method: 'POST',
          limit: 50
        }
      });

      if (error) throw error;
      
      setSchedulerStats(data);
      
      toast({
        title: 'Scheduler executado',
        description: `${data.jobs_executados} jobs executados, ${data.splits_refundados} splits estornados`,
      });

      // Reload jobs
      await loadJobs();
    } catch (error: any) {
      console.error('Error running scheduler:', error);
      toast({
        title: 'Erro ao executar scheduler',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRunningScheduler(false);
    }
  };

  const executeJob = async (jobId: string) => {
    try {
      setExecutingJob(jobId);
      
      const { data, error } = await supabase.functions.invoke('refunds-scheduler', {
        body: { 
          path: `/refunds/${jobId}/execute`,
          method: 'POST'
        }
      });

      if (error) throw error;
      
      if (data.success) {
        toast({
          title: 'Job executado',
          description: 'O job de estorno foi executado com sucesso',
        });
        await loadJobs();
      } else {
        throw new Error(data.error || 'Falha ao executar job');
      }
    } catch (error: any) {
      console.error('Error executing job:', error);
      toast({
        title: 'Erro ao executar job',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setExecutingJob(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadJobs();
    }
  }, [isAdmin, statusFilter, startDate, endDate, chargeIdFilter]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Estornos (24h)</h1>
            <p className="text-muted-foreground">
              Gerenciar estornos automáticos por timeout de splits pendentes
            </p>
          </div>
          <Button 
            onClick={runScheduler} 
            disabled={runningScheduler}
            className="gap-2"
          >
            {runningScheduler ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Executar Scheduler
          </Button>
        </div>

        {/* Scheduler Stats */}
        {schedulerStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Últimas Estatísticas do Scheduler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{schedulerStats.charges_eligiveis}</div>
                  <div className="text-sm text-muted-foreground">Cobranças Elegíveis</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-success">{schedulerStats.jobs_executados}</div>
                  <div className="text-sm text-muted-foreground">Jobs Executados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-info">{schedulerStats.splits_refundados}</div>
                  <div className="text-sm text-muted-foreground">Splits Estornados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-warning">{schedulerStats.errors.length}</div>
                  <div className="text-sm text-muted-foreground">Erros</div>
                </div>
              </div>
              
              {schedulerStats.errors.length > 0 && (
                <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="font-medium text-destructive">Erros Encontrados:</span>
                  </div>
                  <ul className="text-sm space-y-1">
                    {schedulerStats.errors.map((error, index) => (
                      <li key={index} className="text-destructive">• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="processed">Processado</SelectItem>
                    <SelectItem value="failed">Falhado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="start-date">Data Início</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="end-date">Data Fim</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="charge-id">ID da Cobrança</Label>
                <Input
                  id="charge-id"
                  placeholder="UUID da cobrança"
                  value={chargeIdFilter}
                  onChange={(e) => setChargeIdFilter(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={loadJobs} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs de Estorno</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Carregando jobs...
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum job de estorno encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Cobrança</TableHead>
                      <TableHead>Valor Original</TableHead>
                      <TableHead>Taxa (5%)</TableHead>
                      <TableHead>Valor Líquido</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agendado Para</TableHead>
                      <TableHead>Processado Em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-xs">
                          {job.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{job.charges.payer_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {job.charges.description}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {job.charge_id.substring(0, 8)}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(job.original_amount_cents)}</TableCell>
                        <TableCell className="text-destructive">
                          -{formatCurrency(job.fee_amount_cents)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(job.refund_amount_cents - job.fee_amount_cents)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadge(job.status).variant}>
                            {getStatusBadge(job.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(job.scheduled_for), 'dd/MM/yy HH:mm', { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {job.processed_at ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(job.processed_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {['pending', 'failed'].includes(job.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => executeJob(job.id)}
                              disabled={executingJob === job.id}
                            >
                              {executingJob === job.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}