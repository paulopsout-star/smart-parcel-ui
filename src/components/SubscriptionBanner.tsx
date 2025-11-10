import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle } from "lucide-react";

export function SubscriptionBanner() {
  const { subscription, loading, getStatusMessage } = useSubscription();
  const { profile } = useAuth();

  // Show skeleton while loading - never assume canceled during loading
  if (loading) {
    return (
      <div className="w-full">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // Only show banner when canonicalStatus is explicitly 'canceled'
  if (!subscription || subscription.canonicalStatus !== 'canceled') {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-5 w-5" />
      <AlertDescription className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="space-y-1">
            <div className="font-semibold">{getStatusMessage}</div>
            <div className="text-sm">
              Entre em contato com o suporte para reativar sua assinatura e continuar usando todas as funcionalidades.
            </div>
          </div>
          {subscription.raw?.plan_code && (
            <div className="text-sm mt-2">
              Plano: <span className="font-medium">{subscription.raw.plan_code}</span>
            </div>
          )}
        </div>
        {profile?.role === 'admin' && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/subscriptions">
              Gerenciar Assinatura
            </Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
