import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  Calendar,
  LogOut,
  Plus,
  Settings,
  BarChart3,
  Calculator
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { SimulatorModal } from '@/components/SimulatorModal';

interface DashboardStats {
  totalCharges: number;
  activeCharges: number;
  completedCharges: number;
  totalAmount: number;
  recurringCharges: number;
}

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalCharges: 0,
    activeCharges: 0,
    completedCharges: 0,
    totalAmount: 0,
    recurringCharges: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);

  useEffect(() => {
    if (profile?.company_id) {
      loadDashboardStats();
    }
  }, [profile?.company_id]);

  const loadDashboardStats = async () => {
    if (!profile?.company_id) return;
    
    try {
      // RLS agora filtra automaticamente por company_id
      const { data: charges, error } = await supabase
        .from('charges')
        .select('*');

      if (error) {
        console.error('Error loading stats:', error);
        return;
      }

      const totalCharges = charges?.length || 0;
      const activeCharges = charges?.filter(c => c.status === 'pending' || c.status === 'processing').length || 0;
      const completedCharges = charges?.filter(c => c.status === 'completed').length || 0;
      const totalAmount = charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
      const recurringCharges = charges?.filter(c => c.recurrence_type !== 'pontual').length || 0;

      setStats({
        totalCharges,
        activeCharges,
        completedCharges,
        totalAmount,
        recurringCharges,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: "Houve um problema ao fazer logout.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value / 100);
  };

  return (
    <div className="w-full max-w-screen-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo, {profile?.full_name}
          </p>
        </div>
        <Badge variant={profile?.role === 'admin' ? 'default' : 'secondary'} className="w-fit">
          {profile?.role === 'admin' ? 'Administrador' : 'Operador'}
        </Badge>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/new-charge">
            <Plus className="w-4 h-4 mr-2" />
            Nova Cobrança
          </Link>
        </Button>
        
        <Button variant="outline" asChild size="lg" className="w-full sm:w-auto">
          <Link to="/charges">
            <BarChart3 className="w-4 h-4 mr-2" />
            Histórico
          </Link>
        </Button>

        <Button 
          variant="outline" 
          size="lg" 
          className="w-full sm:w-auto"
          onClick={() => setShowSimulatorModal(true)}
        >
          <Calculator className="w-4 h-4 mr-2" />
          Simular Parcelamento
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Cobranças</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCharges}</div>
              <p className="text-xs text-muted-foreground">
                Todas as cobranças
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cobranças Ativas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeCharges}</div>
              <p className="text-xs text-muted-foreground">
                Pendentes ou processando
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedCharges}</div>
              <p className="text-xs text-muted-foreground">
                Pagas com sucesso
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
              <p className="text-xs text-muted-foreground">
                Soma de todas as cobranças
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recorrentes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recurringCharges}</div>
              <p className="text-xs text-muted-foreground">
                Cobranças automáticas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Welcome Message */}
        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo ao Sistema de Cobrança</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Este sistema permite criar e gerenciar cobranças pontuais e recorrentes integradas com o Quita+.
              {profile?.role === 'admin' && ' Como administrador, você tem acesso completo a todas as funcionalidades.'}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Cobranças Pontuais</h3>
                <p className="text-sm text-muted-foreground">
                  Crie cobranças únicas com link de pagamento instantâneo.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Cobranças Recorrentes</h3>
                <p className="text-sm text-muted-foreground">
                  Configure cobranças automáticas diárias, semanais, mensais, etc.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Simulator Modal */}
        <SimulatorModal
          open={showSimulatorModal}
          onOpenChange={setShowSimulatorModal}
        />
    </div>
  );
}