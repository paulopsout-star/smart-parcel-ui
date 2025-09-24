import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface PaymentLinkRequest {
  amount: number;
  orderId: string;
  description: string;
  expirationDate?: string;
  payer: {
    name: string;
    email: string;
    phoneNumber: string;
    document: string;
  };
  checkout: {
    installments: number;
    maskFee: boolean;
  };
  bankslip?: {
    number: string;
    creditorDocument: string;
    creditorName: string;
  };
}

interface PaymentLinkResponse {
  linkId: string;
  linkUrl: string;
  guid: string;
  status: string;
  createdAt: string;
}

interface PaymentLinkHistory {
  id: string;
  linkId: string;
  linkUrl: string;
  amount: number;
  payerName: string;
  payerEmail: string;
  status: string;
  createdAt: string;
  orderId: string;
  description: string;
}

export const useQuitaMaisMock = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinkHistory[]>([]);
  
  const { toast } = useToast();

  const testConnectivity = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock connectivity test delay
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Mock 90% success rate
      if (Math.random() < 0.9) {
        toast({
          title: "Conectividade OK!",
          description: "Conexão com QuitaPlus funcionando corretamente (simulado).",
          variant: "default"
        });
        
        setIsLoading(false);
        return true;
      } else {
        throw new Error('Falha na conectividade simulada');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setError(errorMessage);

      toast({
        title: "Erro de Conectividade",
        description: errorMessage,
        variant: "destructive"
      });

      setIsLoading(false);
      return false;
    }
  }, [toast]);

  const createPaymentLink = useCallback(async (
    request: PaymentLinkRequest,
    orderType: string = 'boleto'
  ): Promise<PaymentLinkResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock creation delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock occasional error (5% chance)
      if (Math.random() < 0.05) {
        throw new Error('Erro simulado na criação do link');
      }

      const mockResponse: PaymentLinkResponse = {
        linkId: `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        linkUrl: `https://checkout-sandbox.quitamais.com.br/pay/${Date.now()}`,
        guid: `guid_${Math.random().toString(36).substr(2, 12)}`,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      // Save to history
      const historyItem: PaymentLinkHistory = {
        id: crypto.randomUUID(),
        linkId: mockResponse.linkId,
        linkUrl: mockResponse.linkUrl,
        amount: request.amount,
        payerName: request.payer.name,
        payerEmail: request.payer.email,
        status: mockResponse.status,
        createdAt: mockResponse.createdAt,
        orderId: request.orderId,
        description: request.description
      };

      setPaymentLinks(prev => [historyItem, ...prev]);

      // Save to localStorage
      localStorage.setItem('quitamais-history', JSON.stringify([historyItem, ...paymentLinks]));

      toast({
        title: "Link de pagamento criado!",
        description: "O link foi gerado com sucesso e está pronto para uso (simulado).",
      });

      setIsLoading(false);
      return mockResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setError(errorMessage);

      toast({
        title: "Erro ao criar link",
        description: errorMessage,
        variant: "destructive",
      });

      setIsLoading(false);
      return null;
    }
  }, [toast, paymentLinks]);

  const getPaymentLinkDetails = useCallback(async (linkId: string): Promise<PaymentLinkResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock search delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock finding existing link (70% chance)
      if (Math.random() < 0.7) {
        const mockDetails: PaymentLinkResponse = {
          linkId: linkId,
          linkUrl: `https://checkout-sandbox.quitamais.com.br/pay/${linkId}`,
          guid: `guid_${linkId}`,
          status: ['active', 'completed', 'expired'][Math.floor(Math.random() * 3)],
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
        };
        
        setIsLoading(false);
        return mockDetails;
      } else {
        setError('Link não encontrado');
        setIsLoading(false);
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado!",
        description: "Link copiado para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const shareViaWhatsApp = useCallback((linkUrl: string, message?: string) => {
    const encodedMessage = encodeURIComponent(
      message || `Olá! Aqui está seu link de pagamento: ${linkUrl}`
    );
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  }, []);

  const shareViaEmail = useCallback((linkUrl: string, email?: string, subject?: string, message?: string) => {
    const encodedSubject = encodeURIComponent(subject || 'Link de Pagamento');
    const encodedMessage = encodeURIComponent(
      message || `Olá!\n\nSeu link de pagamento está disponível em: ${linkUrl}\n\nObrigado!`
    );
    const emailUrl = `mailto:${email || ''}?subject=${encodedSubject}&body=${encodedMessage}`;
    window.open(emailUrl, '_blank');
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Try to load from localStorage first
      const savedHistory = localStorage.getItem('quitamais-history');
      if (savedHistory) {
        const parsedHistory: PaymentLinkHistory[] = JSON.parse(savedHistory);
        setPaymentLinks(parsedHistory);
      } else {
        // Generate some mock history
        const mockHistory: PaymentLinkHistory[] = [
          {
            id: '1',
            linkId: 'link_mock_1',
            linkUrl: 'https://checkout-sandbox.quitamais.com.br/pay/mock1',
            amount: 15000,
            payerName: 'João Silva',
            payerEmail: 'joao@email.com',
            status: 'completed',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            orderId: 'order_1',
            description: 'Pagamento teste'
          },
          {
            id: '2', 
            linkId: 'link_mock_2',
            linkUrl: 'https://checkout-sandbox.quitamais.com.br/pay/mock2',
            amount: 25000,
            payerName: 'Maria Santos',
            payerEmail: 'maria@email.com', 
            status: 'active',
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            orderId: 'order_2',
            description: 'Cobrança mensal'
          }
        ];
        setPaymentLinks(mockHistory);
        localStorage.setItem('quitamais-history', JSON.stringify(mockHistory));
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      setIsLoading(false);
    }
  }, []);

  const saveHistory = useCallback((links: PaymentLinkHistory[]) => {
    localStorage.setItem('quitamais-history', JSON.stringify(links));
  }, []);

  return {
    isLoading,
    error,
    paymentLinks,
    testConnectivity,
    createPaymentLink,
    getPaymentLinkDetails,
    copyToClipboard,
    shareViaWhatsApp,
    shareViaEmail,
    clearError,
    loadHistory,
    saveHistory
  };
};