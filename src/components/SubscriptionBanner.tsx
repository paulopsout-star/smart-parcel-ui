import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Clock, XCircle } from "lucide-react";

export function SubscriptionBanner() {
  const { subscription, loading } = useSubscription();
  const { isAdmin } = useAuth();

  // Show skeleton while loading
  if (loading) {
    return (
      <div className="mb-6">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // Only show banner when status is explicitly 'canceled'
  if (!subscription || subscription.status !== 'canceled') {
    return null;
  }

  const getIcon = () => {
    switch (subscription.status) {
      case 'past_due':
        return <Clock className="h-4 w-4" />;
      case 'canceled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    switch (subscription.status) {
      case 'past_due':
        return 'default';
      case 'canceled':
        return 'destructive';
      default:
        return 'destructive';
    }
  };

  const getMessage = () => {
    switch (subscription.status) {
      case 'past_due':
        return 'Assinatura em atraso — algumas ações podem estar limitadas';
      case 'canceled':
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
                {subscription.plan || 'Sem plano'}
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