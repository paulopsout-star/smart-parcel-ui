import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

  const getPaymentLink = async (chargeId: string): Promise<PaymentLink | null> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('charge-links', {
        body: { 
          method: 'GET',
          path: `/charges/${chargeId}/payment-link`,
          chargeId 
        }
      });

      if (error) throw error;
      return data?.link || null;
    } catch (error: any) {
      console.error('Error getting payment link:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generatePaymentLink = async (chargeId: string): Promise<PaymentLink | null> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('charge-links', {
        body: { 
          method: 'POST',
          path: `/charges/${chargeId}/payment-link`,
          chargeId 
        }
      });

      if (error) throw error;

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
      toast({
        title: "Erro ao gerar link",
        description: error.message || "Não foi possível gerar o link de pagamento",
        variant: "destructive",
      });
      return null;
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

      if (error) throw error;
      return data?.executions || [];
    } catch (error: any) {
      console.error('Error getting executions:', error);
      toast({
        title: "Erro ao carregar execuções",
        description: error.message || "Não foi possível carregar as execuções",
        variant: "destructive",
      });
      return [];
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