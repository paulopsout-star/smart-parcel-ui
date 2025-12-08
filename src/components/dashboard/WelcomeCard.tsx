import { useAuth } from '@/contexts/AuthContext';

export function WelcomeCard() {
  const { profile } = useAuth();

  return (
    <div className="bg-ds-bg-surface rounded-card p-6 shadow-card-soft">
      <h2 className="text-xl font-semibold text-ds-text-strong mb-3">
        Bem-vindo ao Sistema de Cobrança
      </h2>
      <p className="text-ds-text-muted mb-6 leading-relaxed">
        Este sistema permite criar e gerenciar cobranças pontuais e recorrentes integradas com o Quita+.
        {profile?.role === 'admin' && ' Como administrador, você tem acesso completo a todas as funcionalidades.'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-ds-bg-surface-alt border border-ds-border-subtle">
          <h3 className="font-semibold text-ds-text-strong mb-2">Cobranças Pontuais</h3>
          <p className="text-sm text-ds-text-muted">
            Crie cobranças únicas com link de pagamento instantâneo.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-ds-bg-surface-alt border border-ds-border-subtle">
          <h3 className="font-semibold text-ds-text-strong mb-2">Cobranças Recorrentes</h3>
          <p className="text-sm text-ds-text-muted">
            Configure cobranças automáticas diárias, semanais, mensais, etc.
          </p>
        </div>
      </div>
    </div>
  );
}
