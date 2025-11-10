import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useMemo } from 'react';

export interface SubscriptionData {
  canonicalStatus: 'active' | 'trialing' | 'past_due' | 'canceled';
  raw: any;
  companyId: string;
  userId: string;
  computedAt: string;
}

export function useSubscription(companyId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const currentCompanyId = companyId || user?.id || '';

  const {
    data: subscription,
    isLoading: loading,
    error,
    refetch: loadSubscription
  } = useQuery({
    queryKey: ['subscription', currentCompanyId],
    queryFn: async (): Promise<SubscriptionData> => {
      if (!user || !currentCompanyId) {
        throw new Error('No user or companyId available');
      }

      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('No valid session found');
      }

      const functionUrl = `https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/subscription-status`;
      const response = await fetch(`${functionUrl}?companyId=${currentCompanyId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Subscription API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorData
        });
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      return data;
    },
    enabled: !!user && !!currentCompanyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('401')) return false;
      if (error instanceof Error && error.message.includes('403')) return false;
      return failureCount < 3;
    }
  });

  const revalidateOnNewCharge = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['subscription', currentCompanyId] });
  }, [queryClient, currentCompanyId]);

  const checkSubscriptionOrThrow = useCallback(async (): Promise<void> => {
    if (loading || !subscription) {
      const result = await loadSubscription();
      if (!result.data || result.data.canonicalStatus === 'canceled') {
        throw new Error('ASSINATURA_INATIVA: A assinatura da sua empresa não permite esta operação.');
      }
      return;
    }

    if (subscription.canonicalStatus === 'canceled') {
      throw new Error('ASSINATURA_INATIVA: A assinatura da sua empresa não permite esta operação.');
    }
  }, [loading, subscription, loadSubscription]);

  const isAllowed = useCallback(() => {
    if (loading || !subscription) return false;
    return subscription.canonicalStatus !== 'canceled';
  }, [loading, subscription]);

  const getStatusBadgeVariant = useMemo(() => {
    if (loading || !subscription) return 'secondary';
    
    switch (subscription.canonicalStatus) {
      case 'active':
      case 'trialing':
        return 'default';
      case 'past_due':
        return 'secondary';
      case 'canceled':
        return 'destructive';
      default:
        return 'secondary';
    }
  }, [loading, subscription]);

  const getStatusMessage = useMemo(() => {
    if (loading) return 'Carregando status...';
    if (!subscription) return 'Status indisponível';

    switch (subscription.canonicalStatus) {
      case 'active':
        return 'Assinatura ativa';
      case 'trialing':
        return 'Período de teste';
      case 'past_due':
        return 'Assinatura em atraso';
      case 'canceled':
        return 'Assinatura inativa — algumas ações estão bloqueadas';
      default:
        return 'Status desconhecido';
    }
  }, [loading, subscription]);

  return {
    subscription,
    loading,
    error: error?.message || null,
    loadSubscription,
    checkSubscriptionOrThrow,
    isAllowed,
    getStatusBadgeVariant,
    getStatusMessage,
    revalidateOnNewCharge
  };
}