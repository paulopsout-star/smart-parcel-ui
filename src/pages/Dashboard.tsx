import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  TrendingUp, 
  Plus,
  BarChart3,
  Calculator,
  Users,
  CheckCircle,
  Building2,
  Wallet,
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
import { Badge } from '@/components/ui/badge';

interface DashboardStats {
  totalCharges: number;
  activeCharges: number;
  completedCharges: number;
  totalAmount: number;
  completedAmount: number;
  combinedPendingCount: number;
  combinedPaidAmount: number;
}

interface Company {
  id: string;
  name: string;
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalCharges: 0,
    activeCharges: 0,
    completedCharges: 0,
    totalAmount: 0,
    completedAmount: 0,
    combinedPendingCount: 0,
    combinedPaidAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    if (profile?.company_id) {
      loadDashboardStats();
      loadCompany();
    }
  }, [profile?.company_id]);

  const loadCompany = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', profile.company_id)
        .single();

      if (!error && data) {
        setCompany(data);
      }
    } catch (error) {
      console.error('Error loading company:', error);
    }
  };

  const loadDashboardStats = async () => {
    if (!profile?.company_id) return;
    
    try {
      // Buscar cobranças
      const { data: charges, error: chargesError } = await supabase
        .from('charges')
        .select('*');

      if (chargesError) {
        console.error('Error loading charges:', chargesError);
        return;
      }

      // Buscar payment_splits para identificar combinados pendentes
      const { data: splits, error: splitsError } = await supabase
        .from('payment_splits')
        .select('charge_id, method, status, amount_cents')
        .not('charge_id', 'is', null);

      if (splitsError) {
        console.error('Error loading splits:', splitsError);
      }

      // Calcular estatísticas de cobranças
      const totalCharges = charges?.length || 0;
      const activeCharges = charges?.filter(c => c.status === 'pending' || c.status === 'processing').length || 0;
      const completedCharges = charges?.filter(c => c.status === 'completed').length || 0;
      const totalAmount = charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
      const completedAmount = charges
        ?.filter(c => c.status === 'completed')
        .reduce((sum, c) => sum + c.amount, 0) || 0;

      // Agrupar splits por charge_id para identificar combinados
      const chargeGroups = (splits || []).reduce((acc, split) => {
        const chargeId = split.charge_id;
        if (!chargeId) return acc;
        if (!acc[chargeId]) acc[chargeId] = [];
        acc[chargeId].push(split);
        return acc;
      }, {} as Record<string, typeof splits>);

      // Identificar combinados com pendência (mais de 1 split, 1 concluded + 1 pending)
      const combinedPending = Object.values(chargeGroups).filter(splitGroup => {
        if (!splitGroup || splitGroup.length <= 1) return false;
        const hasConcluded = splitGroup.some(s => s.status === 'concluded');
        const hasPending = splitGroup.some(s => s.status === 'pending');
        return hasConcluded && hasPending;
      });

      const combinedPendingCount = combinedPending.length;
      const combinedPaidAmount = combinedPending
        .flatMap(splitGroup => (splitGroup || []).filter(s => s.status === 'concluded'))
        .reduce((sum, s) => sum + (s.amount_cents || 0), 0);

      setStats({
        totalCharges,
        activeCharges,
        completedCharges,
        totalAmount,
        completedAmount,
        combinedPendingCount,
        combinedPaidAmount,
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
        {/* Admin/Company Indicator */}
        <section className="flex items-center gap-3">
          {isAdmin ? (
            <Badge variant="info" className="gap-1.5 px-3 py-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Visão Consolidada - Todas as Empresas
            </Badge>
          ) : company && (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {company.name}
            </Badge>
          )}
        </section>

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
              icon={Wallet}
              label="Pagamentos Concluídos"
              value={formatCurrency(stats.completedAmount)}
              description="Total de valores pagos com sucesso"
              variant="highlight"
            />
            <StatCard
              icon={CreditCard}
              label="Combinados Pendentes"
              value={stats.combinedPendingCount}
              description="PIX ou cartão pago, outro pendente"
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
