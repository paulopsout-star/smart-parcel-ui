import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface SubscriptionContextType {
  readOnly: boolean;
  canonicalStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'loading';
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  readOnly: false,
  canonicalStatus: 'loading',
});

// Lista de rotas públicas que não precisam verificar assinatura
const PUBLIC_ROUTES = [
  /^\/$/,
  /^\/login$/,
  /^\/register$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/checkout\/[^/]+$/,
  /^\/payment-direct\/[^/]+$/,
  /^\/payment-pix\/[^/]+$/,
  /^\/payment-card\/[^/]+$/,
  /^\/thank-you$/,
  /^\/simulador$/,
  /^\/payment$/,
];

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  
  // Verificar se é rota pública ANTES de chamar useSubscription
  const isPublicRoute = PUBLIC_ROUTES.some(pattern => pattern.test(location.pathname));
  
  // Se é rota pública, não verificar assinatura
  if (isPublicRoute) {
    return (
      <SubscriptionContext.Provider value={{ readOnly: false, canonicalStatus: 'active' }}>
        {children}
      </SubscriptionContext.Provider>
    );
  }

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
