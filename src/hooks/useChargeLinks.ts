import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useChargeLinksMock } from './useChargeLinksMock';

interface PaymentLink {
  id: string;
  token: string;
  url: string;
  absolute_url: string;
  status: string;
}

interface ChargeExecution {
  id: string;
  execution_date: string;
  status: string;
  payment_link_url?: string;
  payment_link_id?: string;
  scheduled_for?: string;
}

export function useChargeLinks() {
  const [loading, setLoading] = useState(false);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  
  // Fallback to mock when edge functions fail
  const mockHooks = useChargeLinksMock();

  const handleEdgeFunctionError = (error: any, operation: string) => {
    console.error(`Edge Function error in ${operation}:`, error);
    
    let status = 'unknown';
    let message = 'Erro desconhecido';
    
    if (error?.message) {
      // Try to extract status and message from error
      const errorStr = error.message;
      const statusMatch = errorStr.match(/status[:\s]*(\d+)/i);
      if (statusMatch) {
        status = statusMatch[1];
      }
      
      if (errorStr.includes('non-2xx status code')) {
        message = `Edge Function retornou status ${status}`;
      } else {
        message = errorStr;
      }
    }
    
    toast({
      title: `Erro ao ${operation}`,
      description: `${status !== 'unknown' ? status + ': ' : ''}${message}. Usando fallback mock.`,
      variant: "destructive",
    });
  };

  const getPaymentLink = async (chargeId: string): Promise<PaymentLink | null> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('charge-links', {
        body: { 
          chargeId: chargeId,
          action: 'get'
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        // Don't treat 404 as an error - just means no link exists
        if (error.message?.includes('404') || data?.code === 'NOT_FOUND') {
          return null;
        }
        
        // For other errors, fallback to mock
        handleEdgeFunctionError(error, 'buscar link');
        setLoading(false);
        return await mockHooks.getPaymentLink(chargeId);
      }
      return data?.link || null;
    } catch (error: any) {
      console.error('Error getting payment link:', error);
      handleEdgeFunctionError(error, 'buscar link');
      setLoading(false);
      return await mockHooks.getPaymentLink(chargeId);
    } finally {
      setLoading(false);
    }
  };

  const generatePaymentLink = async (chargeId: string): Promise<PaymentLink | null> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('charge-links', {
        body: { 
          chargeId: chargeId,
          action: 'create'
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        
        // Handle specific error codes
        if (data?.code === 'SUBSCRIPTION_BLOCKED') {
          toast({
            title: "Assinatura necessária",
            description: "É necessário ter uma assinatura ativa para gerar novos links de pagamento",
            variant: "destructive",
          });
          return null;
        }
        
        // For other errors, fallback to mock
        handleEdgeFunctionError(error, 'gerar link');
        setLoading(false);
        return await mockHooks.generatePaymentLink(chargeId);
      }

      if (data?.link) {
        toast({
          title: "Link gerado com sucesso",
          description: "O link de pagamento foi criado e está pronto para uso",
        });
        return data.link;
      }

      return null;
    } catch (error: any) {
      console.error('Error generating payment link:', error);
      handleEdgeFunctionError(error, 'gerar link');
      setLoading(false);
      return await mockHooks.generatePaymentLink(chargeId);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copiado",
        description: "O link foi copiado para a área de transferência",
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link",
        variant: "destructive",
      });
    }
  };

  const openPaymentLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getChargeExecutions = async (chargeId: string): Promise<ChargeExecution[]> => {
    try {
      setExecutionsLoading(true);
      const { data, error } = await supabase.functions.invoke('recurrences-manager', {
        body: { 
          action: 'get_executions',
          charge_id: chargeId
        }
      });

      if (error) {
        handleEdgeFunctionError(error, 'carregar execuções');
        setExecutionsLoading(false);
        return await mockHooks.getChargeExecutions(chargeId);
      }
      return data?.executions || [];
    } catch (error: any) {
      console.error('Error getting executions:', error);
      handleEdgeFunctionError(error, 'carregar execuções');
      setExecutionsLoading(false);
      return await mockHooks.getChargeExecutions(chargeId);
    } finally {
      setExecutionsLoading(false);
    }
  };

  return {
    loading,
    executionsLoading,
    getPaymentLink,
    generatePaymentLink,
    copyToClipboard,
    openPaymentLink,
    getChargeExecutions
  };
}