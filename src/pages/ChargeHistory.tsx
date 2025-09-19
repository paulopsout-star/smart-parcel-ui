import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Charge {
  id: string;
  payer_name: string;
  payer_email: string;
  amount: number;
  description: string;
  status: string;
  recurrence_type: string;
  created_at: string;
  next_charge_date: string | null;
  executions: Array<{
    id: string;
    execution_date: string;
    status: string;
    payment_link_url: string | null;
  }>;
}

export function ChargeHistory() {
  const { isOperador } = useAuth();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (isOperador) {
      fetchCharges();
    }
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
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(charge.status)}
                  <Badge variant="outline">{getRecurrenceLabel(charge.recurrence_type)}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium">Valor</p>
                  <p className="text-lg">R$ {(charge.amount / 100).toFixed(2)}</p>
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
    </div>
  );
}