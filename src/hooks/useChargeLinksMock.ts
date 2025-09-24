import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

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

export function useChargeLinksMock() {
  const [loading, setLoading] = useState(false);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const { toast } = useToast();

  const getPaymentLink = useCallback(async (chargeId: string): Promise<PaymentLink | null> => {
    setLoading(true);
    
    // Mock latency
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock existing link check (50% chance to have existing link)
    const hasExistingLink = Math.random() > 0.5;
    
    if (hasExistingLink) {
      const mockLink: PaymentLink = {
        id: `link_${chargeId}`,
        token: `token_${Date.now()}`,
        url: `/payment?token=mock_${chargeId}`,
        absolute_url: `https://checkout.autonegocie.com.br/mock/${chargeId}`,
        status: 'active'
      };
      
      setLoading(false);
      return mockLink;
    }
    
    setLoading(false);
    return null;
  }, []);

  const generatePaymentLink = useCallback(async (chargeId: string): Promise<PaymentLink | null> => {
    setLoading(true);
    
    try {
      // Mock generation delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock occasional subscription error (10% chance)
      if (Math.random() < 0.1) {
        toast({
          title: "Assinatura necessária",
          description: "É necessário ter uma assinatura ativa para gerar novos links de pagamento",
          variant: "destructive",
        });
        return null;
      }
      
      const mockLink: PaymentLink = {
        id: `link_${chargeId}_${Date.now()}`,
        token: `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: `/payment?token=mock_${chargeId}`,
        absolute_url: `https://checkout.autonegocie.com.br/mock/${chargeId}`,
        status: 'active'
      };
      
      toast({
        title: "Link gerado com sucesso",
        description: "O link de pagamento foi criado e está pronto para uso",
      });
      
      setLoading(false);
      return mockLink;
    } catch (error) {
      console.error('Erro ao gerar link:', error);
      toast({
        title: "Erro ao gerar link",
        description: "Não foi possível gerar o link de pagamento",
        variant: "destructive",
      });
      setLoading(false);
      return null;
    }
  }, [toast]);

  const copyToClipboard = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copiado",
        description: "O link foi copiado para a área de transferência",
      });
    } catch (error) {
      console.error('Erro ao copiar:', error);
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link",
        variant: "destructive",
      });
    }
  }, [toast]);

  const openPaymentLink = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const getChargeExecutions = useCallback(async (chargeId: string): Promise<ChargeExecution[]> => {
    setExecutionsLoading(true);
    
    try {
      // Mock loading delay
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Generate mock executions
      const mockExecutions: ChargeExecution[] = [
        {
          id: `exec_${chargeId}_1`,
          execution_date: new Date().toISOString(),
          status: 'completed',
          payment_link_url: `https://checkout.autonegocie.com.br/mock/${chargeId}`,
          payment_link_id: `link_${chargeId}`
        },
        {
          id: `exec_${chargeId}_2`,
          execution_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          scheduled_for: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      
      setExecutionsLoading(false);
      return mockExecutions;
    } catch (error: any) {
      console.error('Erro ao carregar execuções:', error);
      toast({
        title: "Erro ao carregar execuções",
        description: "Não foi possível carregar as execuções",
        variant: "destructive",
      });
      setExecutionsLoading(false);
      return [];
    }
  }, [toast]);

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