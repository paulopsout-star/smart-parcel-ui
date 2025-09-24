import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SubscriptionData {
  status: 'loading' | 'active' | 'canceled' | 'past_due';
  plan?: string;
  ends_at?: string;
  canceled_at?: string;
  orgId: string;
}

export function useSubscription(orgId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const currentOrgId = orgId || user?.id || '';

  const {
    data: subscription,
    isLoading: loading,
    error,
    refetch: loadSubscription
  } = useQuery({
    queryKey: ['subscription', currentOrgId],
    queryFn: async (): Promise<SubscriptionData> => {
      if (!user || !currentOrgId) {
        throw new Error('No user or orgId available');
      }

      console.log('🔍 Fetching subscription status:', {
        orgId: currentOrgId,
        userId: user.id,
        fetchedAt: new Date().toISOString()
      });

      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('No valid session found');
      }

      const functionUrl = `https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/subscription-status`;
      const response = await fetch(`${functionUrl}?orgId=${currentOrgId}`, {
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
        throw new Error(`API error: ${response.status} - ${response.statusText}. ${errorData}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      console.log('✅ Subscription fetched:', {
        orgId: currentOrgId,
        status: data.status,
        plan: data.plan,
        fetchedAt: new Date().toISOString()
      });

      return data;
    },
    enabled: !!user && !!currentOrgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on 401/403 errors
      if (error instanceof Error && error.message.includes('401')) return false;
      if (error instanceof Error && error.message.includes('403')) return false;
      return failureCount < 3;
    }
  });

  // Revalidate subscription when opening "Nova Cobrança"
  const revalidateOnNewCharge = () => {
    queryClient.invalidateQueries({ queryKey: ['subscription', currentOrgId] });
  };

  const checkSubscriptionOrThrow = async (): Promise<void> => {
    // Force refetch if subscription is not loaded
    if (loading || !subscription) {
      const result = await loadSubscription();
      if (!result.data || result.data.status === 'canceled') {
        throw new Error('ASSINATURA_INATIVA: A assinatura da sua empresa não permite esta operação.');
      }
      return;
    }

    if (subscription.status === 'canceled') {
      throw new Error('ASSINATURA_INATIVA: A assinatura da sua empresa não permite esta operação.');
    }
  };

  const isAllowed = () => {
    if (loading || !subscription) return false;
    return subscription.status === 'active' || subscription.status === 'past_due';
  };

  const getStatusBadgeVariant = () => {
    if (loading || !subscription) return 'secondary';
    
    switch (subscription.status) {
      case 'active':
        return 'default';
      case 'past_due':
        return 'secondary';
      case 'canceled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusMessage = () => {
    if (loading) return 'Carregando status...';
    if (!subscription) return 'Status indisponível';

    switch (subscription.status) {
      case 'active':
        return 'Assinatura ativa';
      case 'past_due':
        return 'Assinatura em atraso';
      case 'canceled':
        return 'Assinatura inativa — algumas ações estão bloqueadas';
      default:
        return 'Status desconhecido';
    }
  };

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