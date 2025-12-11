import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const lastGoodSettings = useRef<CompanySettings | null>(null);
  const hasLoggedOnce = useRef(false);
  const retryCount = useRef(0);

  const fetchSettings = useCallback(async (): Promise<CompanySettings> => {
    if (!user) throw new Error('User not authenticated');

    // SEMPRE buscar sessão fresca - ignorar qualquer cache
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !currentSession) {
      console.warn('[useCompanySettings] ⚠️ Sessão inválida, tentando refresh...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        console.error('[useCompanySettings] ❌ Falha ao renovar sessão:', refreshError);
        // Limpar cache e forçar re-login
        queryClient.invalidateQueries({ queryKey: ['company-settings'] });
        throw new Error('Sessão expirada - faça login novamente');
      }
      
      console.log('[useCompanySettings] ✅ Sessão renovada com sucesso');
    }
    
    // Buscar sessão novamente após possível refresh
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    const accessToken = freshSession?.access_token;
    
    if (!accessToken) {
      console.error('[useCompanySettings] ❌ Sem access token disponível');
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      throw new Error('Token de acesso indisponível');
    }

    console.log('[useCompanySettings] 🔑 Usando token:', accessToken.substring(0, 20) + '...');

    // Invoke com headers explícitos para garantir token fresco
    const { data, error } = await supabase.functions.invoke<CompanySettings>('company-settings', {
      body: {},
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) {
      // Se 401, invalidar cache e tentar refresh uma vez
      if (error.message?.includes('401') && retryCount.current < 1) {
        retryCount.current++;
        console.warn('[useCompanySettings] ⚠️ 401 recebido, renovando sessão...');
        
        // Invalidar cache
        queryClient.invalidateQueries({ queryKey: ['company-settings'] });
        
        const { data: newSessionData } = await supabase.auth.refreshSession();
        const newToken = newSessionData.session?.access_token;
        
        if (!newToken) {
          throw new Error('Falha ao obter novo token');
        }
        
        console.log('[useCompanySettings] 🔄 Retry com novo token');
        
        // Retry com novo token
        const retryResult = await supabase.functions.invoke<CompanySettings>('company-settings', {
          body: {},
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
        });
        if (retryResult.error) throw retryResult.error;
        if (!retryResult.data) throw new Error('Nenhum dado retornado');
        retryCount.current = 0;
        return retryResult.data;
      }
      throw error;
    }
    
    if (!data) throw new Error('Nenhum dado retornado');
    retryCount.current = 0;
    return data;
  }, [user, queryClient]);

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
