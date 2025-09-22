import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Settings, 
  Plus, 
  Edit3, 
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle
} from "lucide-react";

interface Subscription {
  id: string;
  company_id: string;
  owner_id: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  plan_code?: string;
  started_at: string;
  current_period_end?: string;
  grace_days: number;
  canceled_at?: string;
  updated_at: string;
  profiles?: {
    full_name: string;
  };
}

interface EditSubscriptionData {
  status: string;
  grace_days: number;
  current_period_end: string;
  plan_code: string;
}

export default function SubscriptionManagement() {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [editData, setEditData] = useState<EditSubscriptionData>({
    status: '',
    grace_days: 7,
    current_period_end: '',
    plan_code: ''
  });
  const [filters, setFilters] = useState({
    status: 'all',
    page: 1
  });

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('No valid session found');
      }

      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      params.append('page', filters.page.toString());

      const functionUrl = `https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/subscription-manager/list?${params}`;
      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setSubscriptions(result.data || []);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar assinaturas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSubscription = async (subscription: Subscription, data: Partial<EditSubscriptionData>) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('No valid session found');
      }

      const functionUrl = `https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/subscription-manager/set`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_id: subscription.company_id,
          ...data
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: "Sucesso",
        description: "Assinatura atualizada com sucesso"
      });

      loadSubscriptions();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar assinatura",
        variant: "destructive"
      });
    }
  };

  const handleEditClick = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setEditData({
      status: subscription.status,
      grace_days: subscription.grace_days,
      current_period_end: subscription.current_period_end 
        ? format(new Date(subscription.current_period_end), 'yyyy-MM-dd')
        : format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      plan_code: subscription.plan_code || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSubscription) return;

    await updateSubscription(editingSubscription, {
      ...editData,
      current_period_end: editData.current_period_end 
        ? new Date(editData.current_period_end + 'T23:59:59-03:00').toISOString()
        : undefined
    });

    setEditingSubscription(null);
  };

  const quickStatusUpdate = async (subscription: Subscription, status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED') => {
    await updateSubscription(subscription, { status });
  };

  useEffect(() => {
    loadSubscriptions();
  }, [filters]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'PAST_DUE':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'CANCELED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'default';
      case 'PAST_DUE':
        return 'secondary';
      case 'CANCELED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };

  const formatGraceUntil = (subscription: Subscription) => {
    if (subscription.status !== 'PAST_DUE') return '-';
    
    const periodEnd = subscription.current_period_end 
      ? new Date(subscription.current_period_end)
      : new Date(subscription.started_at);
    
    const graceUntil = new Date(periodEnd.getTime() + (subscription.grace_days * 24 * 60 * 60 * 1000));
    
    return format(graceUntil, 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gerenciamento de Assinaturas</h1>
        <Button onClick={loadSubscriptions} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Status</Label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value, page: 1 }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="PAST_DUE">Em Atraso</SelectItem>
                  <SelectItem value="CANCELED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Assinaturas */}
      <Card>
        <CardHeader>
          <CardTitle>Assinaturas</CardTitle>
          <CardDescription>
            Gerencie as assinaturas das empresas do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Carregando assinaturas...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Grace até</TableHead>
                  <TableHead>Período fim</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {subscription.profiles?.full_name || 'Sem nome'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {subscription.company_id.slice(0, 8)}...
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(subscription.status)}
                        <Badge variant={getStatusBadgeVariant(subscription.status)}>
                          {subscription.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {subscription.plan_code || 'Sem plano'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatGraceUntil(subscription)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(subscription.current_period_end)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(subscription.updated_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => quickStatusUpdate(subscription, 'ACTIVE')}
                          disabled={subscription.status === 'ACTIVE'}
                        >
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => quickStatusUpdate(subscription, 'PAST_DUE')}
                          disabled={subscription.status === 'PAST_DUE'}
                        >
                          <Clock className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => quickStatusUpdate(subscription, 'CANCELED')}
                          disabled={subscription.status === 'CANCELED'}
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(subscription)}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={!!editingSubscription} onOpenChange={(open) => !open && setEditingSubscription(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Assinatura</DialogTitle>
            <DialogDescription>
              Altere os detalhes da assinatura da empresa
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={editData.status} onValueChange={(value) => setEditData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="PAST_DUE">Em Atraso</SelectItem>
                  <SelectItem value="CANCELED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Dias de Carência</Label>
              <Input
                type="number"
                value={editData.grace_days}
                onChange={(e) => setEditData(prev => ({ ...prev, grace_days: parseInt(e.target.value) || 0 }))}
                min="0"
                max="90"
              />
            </div>

            <div>
              <Label>Fim do Período Atual</Label>
              <Input
                type="date"
                value={editData.current_period_end}
                onChange={(e) => setEditData(prev => ({ ...prev, current_period_end: e.target.value }))}
              />
            </div>

            <div>
              <Label>Código do Plano</Label>
              <Input
                value={editData.plan_code}
                onChange={(e) => setEditData(prev => ({ ...prev, plan_code: e.target.value }))}
                placeholder="basic-mensal, pro-anual, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSubscription(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}