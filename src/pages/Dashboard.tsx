import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  TrendingUp, 
  Calendar,
  Plus,
  BarChart3,
  Calculator,
  Users,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SimulatorModal } from '@/components/SimulatorModal';
import { 
  DashboardShell, 
  StatCard, 
  QuickActionCard, 
  WelcomeCard 
} from '@/components/dashboard';

interface DashboardStats {
  totalCharges: number;
  activeCharges: number;
  completedCharges: number;
  totalAmount: number;
  recurringCharges: number;
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value / 100);
  };

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Quick Actions */}
        <section>
          <h2 className="text-sm font-medium text-ds-text-muted uppercase tracking-wide mb-4">
            Ações Rápidas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickActionCard
              icon={Plus}
              title="Nova Cobrança"
              description="Criar cobrança pontual ou recorrente"
              href="/new-charge"
              variant="primary"
            />
            <QuickActionCard
              icon={BarChart3}
              title="Histórico"
              description="Ver todas as cobranças"
              href="/charges"
            />
            <QuickActionCard
              icon={Calculator}
              title="Simulador"
              description="Simular parcelamento"
              onClick={() => setShowSimulatorModal(true)}
            />
            {isAdmin && (
              <QuickActionCard
                icon={Users}
                title="Gestão de Usuários"
                description="Administrar equipe"
                href="/admin/users"
              />
            )}
          </div>
        </section>

        {/* Stats Grid */}
        <section>
          <h2 className="text-sm font-medium text-ds-text-muted uppercase tracking-wide mb-4">
            Resumo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard
              icon={CreditCard}
              label="Total de Cobranças"
              value={stats.totalCharges}
              description="Todas as cobranças"
            />
            <StatCard
              icon={TrendingUp}
              label="Cobranças Ativas"
              value={stats.activeCharges}
              description="Pendentes ou processando"
              delta={stats.activeCharges > 0 ? { value: 12, type: 'increase' } : undefined}
            />
            <StatCard
              icon={CheckCircle}
              label="Concluídas"
              value={stats.completedCharges}
              description="Pagas com sucesso"
            />
            <StatCard
              icon={TrendingUp}
              label="Valor Total"
              value={formatCurrency(stats.totalAmount)}
              description="Soma de todas as cobranças"
              variant="highlight"
            />
            <StatCard
              icon={Calendar}
              label="Recorrentes"
              value={stats.recurringCharges}
              description="Cobranças automáticas"
            />
          </div>
        </section>

        {/* Welcome Card */}
        <section>
          <WelcomeCard />
        </section>

        {/* Simulator Modal */}
        <SimulatorModal
          open={showSimulatorModal}
          onOpenChange={setShowSimulatorModal}
        />
      </div>
    </DashboardShell>
  );
}
