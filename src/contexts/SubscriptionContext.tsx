import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Loader2 } from 'lucide-react';

interface SubscriptionContextType {
  readOnly: boolean;
  canonicalStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'loading';
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  readOnly: false,
  canonicalStatus: 'loading',
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading } = useSubscription(user?.id);

  // Se ainda está carregando auth ou subscription
  if (authLoading || subLoading) {
    return (
      <SubscriptionContext.Provider value={{ readOnly: false, canonicalStatus: 'loading' }}>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SubscriptionContext.Provider>
    );
  }

  // Se não há usuário, considerar como ativo (para páginas públicas)
  if (!user) {
    return (
      <SubscriptionContext.Provider value={{ readOnly: false, canonicalStatus: 'active' }}>
        {children}
      </SubscriptionContext.Provider>
    );
  }

  // Calcular status baseado na assinatura
  const canonicalStatus = subscription?.canonicalStatus || 'canceled';
  const readOnly = canonicalStatus === 'past_due';

  return (
    <SubscriptionContext.Provider value={{ readOnly, canonicalStatus }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext() {
  return useContext(SubscriptionContext);
}
