import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useRef, useEffect, useCallback } from 'react';

export interface CompanySettings {
  creditor_document: string;
  creditor_name: string;
  merchant_id: string;
}

export function useCompanySettings() {
  const { user } = useAuth();
  const lastGoodSettings = useRef<CompanySettings | null>(null);
  const hasLoggedOnce = useRef(false);
  const retryCount = useRef(0);

  const fetchSettings = useCallback(async (): Promise<CompanySettings> => {
    if (!user) throw new Error('User not authenticated');

    // Ensure we have a fresh session before calling the edge function
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session) {
      console.warn('[useCompanySettings] Session invalid, attempting refresh...');
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error('[useCompanySettings] Failed to refresh session:', refreshError);
        throw new Error('Session expired - please login again');
      }
    }

    const { data, error } = await supabase.functions.invoke<CompanySettings>('company-settings', {
      body: {},
    });

    if (error) {
      // If 401, try to refresh session once
      if (error.message?.includes('401') && retryCount.current < 1) {
        retryCount.current++;
        console.warn('[useCompanySettings] Got 401, refreshing session...');
        await supabase.auth.refreshSession();
        // Retry after refresh
        const retryResult = await supabase.functions.invoke<CompanySettings>('company-settings', {
          body: {},
        });
        if (retryResult.error) throw retryResult.error;
        if (!retryResult.data) throw new Error('No data returned from company-settings');
        retryCount.current = 0;
        return retryResult.data;
      }
      throw error;
    }
    
    if (!data) throw new Error('No data returned from company-settings');
    retryCount.current = 0;
    return data;
  }, [user]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['company-settings', user?.id],
    queryFn: fetchSettings,
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const isValid = !!(data?.creditor_document && data?.creditor_name && data?.merchant_id);

  // Update lastGoodSettings when we have valid data
  useEffect(() => {
    if (isValid && data) {
      lastGoodSettings.current = data;
      
      if (!hasLoggedOnce.current) {
        console.log('[useCompanySettings] ✅ Settings loaded:', {
          creditor_document: data.creditor_document ? '***' + data.creditor_document.slice(-4) : 'EMPTY',
          creditor_name: data.creditor_name || 'EMPTY',
          merchant_id: data.merchant_id ? '***' + data.merchant_id.slice(-4) : 'EMPTY',
        });
        hasLoggedOnce.current = true;
      }
    }
  }, [isValid, data]);

  return {
    data: data || lastGoodSettings.current,
    isLoading,
    isError,
    error,
    isValid: isValid || !!lastGoodSettings.current,
    lastGoodSettings: lastGoodSettings.current,
  };
}
