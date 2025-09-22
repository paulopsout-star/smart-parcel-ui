import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SubscriptionStatus {
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  allowed: boolean;
  grace_days: number;
  grace_until?: string;
  current_period_end?: string;
  plan_code?: string;
  company_id: string;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('No valid session found');
      }

      const functionUrl = `https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/subscription-manager/status`;
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

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setSubscription(data);
    } catch (err) {
      console.error('Error loading subscription:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar assinatura');
      
      // Fallback: assinatura cancelada
      setSubscription({
        status: 'CANCELED',
        allowed: false,
        grace_days: 7,
        company_id: user.id
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, [user]);

  const checkSubscriptionOrThrow = async (): Promise<void> => {
    if (!subscription) {
      await loadSubscription();
    }

    if (!subscription?.allowed) {
      throw new Error('ASSINATURA_INATIVA: A assinatura da sua empresa não permite esta operação.');
    }
  };

  const isAllowed = () => {
    return subscription?.allowed ?? false;
  };

  const getStatusBadgeVariant = () => {
    if (!subscription) return 'secondary';
    
    switch (subscription.status) {
      case 'ACTIVE':
        return 'default';
      case 'PAST_DUE':
        return subscription.allowed ? 'secondary' : 'destructive';
      case 'CANCELED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusMessage = () => {
    if (!subscription) return '';

    switch (subscription.status) {
      case 'ACTIVE':
        return 'Assinatura ativa';
      case 'PAST_DUE':
        if (subscription.allowed && subscription.grace_until) {
          const graceDate = new Date(subscription.grace_until);
          return `Atraso — uso permitido até ${graceDate.toLocaleDateString('pt-BR')}`;
        }
        return 'Assinatura inativa — algumas ações estão bloqueadas';
      case 'CANCELED':
        return 'Assinatura inativa — algumas ações estão bloqueadas';
      default:
        return '';
    }
  };

  return {
    subscription,
    loading,
    error,
    loadSubscription,
    checkSubscriptionOrThrow,
    isAllowed,
    getStatusBadgeVariant,
    getStatusMessage
  };
}