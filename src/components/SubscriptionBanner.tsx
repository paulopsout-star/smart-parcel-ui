import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";

export function SubscriptionBanner() {
  const { subscription, loading } = useSubscription();
  const { isAdmin } = useAuth();

  if (loading || !subscription) {
    return null;
  }

  // Não mostrar banner se está ativo
  if (subscription.status === 'ACTIVE') {
    return null;
  }

  const getIcon = () => {
    switch (subscription.status) {
      case 'ACTIVE':
        return <CheckCircle className="h-4 w-4" />;
      case 'PAST_DUE':
        return subscription.allowed ? <Clock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />;
      case 'CANCELED':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    switch (subscription.status) {
      case 'ACTIVE':
        return 'default';
      case 'PAST_DUE':
        return subscription.allowed ? 'default' : 'destructive';
      case 'CANCELED':
        return 'destructive';
      default:
        return 'destructive';
    }
  };

  const getMessage = () => {
    switch (subscription.status) {
      case 'PAST_DUE':
        if (subscription.allowed && subscription.grace_until) {
          const graceDate = new Date(subscription.grace_until);
          return `Assinatura em atraso — uso permitido até ${graceDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'America/Sao_Paulo'
          })}`;
        }
        return 'Assinatura inativa — algumas ações estão bloqueadas';
      case 'CANCELED':
        return 'Assinatura cancelada — algumas ações estão bloqueadas';
      default:
        return 'Status da assinatura requer atenção';
    }
  };

  return (
    <Alert variant={getVariant()} className="mb-6">
      <div className="flex items-center gap-2">
        {getIcon()}
        <div className="flex-1">
          <AlertDescription className="flex items-center justify-between">
            <span>{getMessage()}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {subscription.plan_code || 'Sem plano'}
              </Badge>
              {isAdmin && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/subscriptions">
                    Gerenciar Assinatura
                  </Link>
                </Button>
              )}
            </div>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}