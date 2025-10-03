import { Navigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'operador';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading } = useSubscription(user?.id);

  // Show loading while auth or subscription is loading
  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Check authentication
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check profile and active status
  if (!profile || !profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">Sua conta não está ativa ou não foi configurada corretamente.</p>
        </div>
      </div>
    );
  }

  // Check role-based access
  if (requiredRole === 'admin' && profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
        </div>
      </div>
    );
  }

  // Check subscription status
  const canonicalStatus = subscription?.canonicalStatus || 'loading';
  
  // Block access if subscription is canceled
  if (canonicalStatus === 'canceled') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="mt-2">
              <div className="space-y-3">
                <div>
                  <div className="font-semibold">Assinatura Inativa</div>
                  <div className="text-sm mt-1">
                    Sua assinatura está cancelada. Entre em contato com o suporte para reativar 
                    e continuar usando o sistema.
                  </div>
                </div>
                {profile.role === 'admin' && (
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link to="/admin/subscriptions">
                      Gerenciar Assinatura
                    </Link>
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Determine if user should have read-only access
  const readOnly = canonicalStatus === 'past_due';

  // Log subscription status for audit
  console.log('ProtectedRoute - Subscription Check:', {
    userId: user.id,
    companyId: profile.id,
    canonicalStatus,
    readOnly,
  });

  // Children já tem acesso ao contexto de subscription via provider global
  return <>{children}</>;
}