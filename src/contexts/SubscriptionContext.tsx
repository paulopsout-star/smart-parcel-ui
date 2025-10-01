import React, { createContext, useContext } from 'react';

interface SubscriptionContextType {
  readOnly: boolean;
  canonicalStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'loading';
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  readOnly: false,
  canonicalStatus: 'loading',
});

export function SubscriptionProvider({ 
  children, 
  readOnly, 
  canonicalStatus 
}: { 
  children: React.ReactNode;
  readOnly: boolean;
  canonicalStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'loading';
}) {
  return (
    <SubscriptionContext.Provider value={{ readOnly, canonicalStatus }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext() {
  return useContext(SubscriptionContext);
}
