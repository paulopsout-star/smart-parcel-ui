import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  PaymentLinkRequest, 
  PaymentLinkResponse, 
  PaymentLinkHistory, 
  OrderType,
  QuitaMaisError 
} from '@/types/quitamais';

interface UseQuitaMaisState {
  isLoading: boolean;
  error: string | null;
  paymentLinks: PaymentLinkHistory[];
}

export const useQuitaMais = () => {
  const [state, setState] = useState<UseQuitaMaisState>({
    isLoading: false,
    error: null,
    paymentLinks: []
  });
  
  const { toast } = useToast();

  const createPaymentLink = useCallback(async (
    request: PaymentLinkRequest,
    orderType: OrderType = 'boleto'
  ): Promise<PaymentLinkResponse | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // First, get authentication token
      const tokenResponse = await fetch('/api/quitamais/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!tokenResponse.ok) {
        throw new Error('Falha na autenticação');
      }

      // Create payment link
      const linkResponse = await fetch('/api/quitamais/payment-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          orderType
        }),
      });

      if (!linkResponse.ok) {
        const errorData = await linkResponse.json();
        throw new Error(errorData.message || 'Erro ao criar link de pagamento');
      }

      const paymentLink: PaymentLinkResponse = await linkResponse.json();

      // Add to local history
      const historyItem: PaymentLinkHistory = {
        id: crypto.randomUUID(),
        linkId: paymentLink.linkId,
        linkUrl: paymentLink.linkUrl,
        amount: request.amount,
        payerName: request.payer.name,
        payerEmail: request.payer.email,
        status: paymentLink.status,
        createdAt: new Date().toISOString(),
        orderId: request.orderId,
        description: request.description
      };

      setState(prev => ({
        ...prev,
        isLoading: false,
        paymentLinks: [historyItem, ...prev.paymentLinks]
      }));

      toast({
        title: "Link de pagamento criado!",
        description: "O link foi gerado com sucesso e está pronto para uso.",
      });

      return paymentLink;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));

      toast({
        title: "Erro ao criar link",
        description: errorMessage,
        variant: "destructive",
      });

      return null;
    }
  }, [toast]);

  const getPaymentLinkDetails = useCallback(async (linkId: string): Promise<PaymentLinkResponse | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/quitamais/payment-link/${linkId}`);
      
      if (!response.ok) {
        throw new Error('Erro ao consultar link de pagamento');
      }

      const linkDetails: PaymentLinkResponse = await response.json();
      
      setState(prev => ({ ...prev, isLoading: false }));
      
      return linkDetails;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));

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
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const loadHistory = useCallback(() => {
    // Load from localStorage or API
    const savedHistory = localStorage.getItem('quitamais-history');
    if (savedHistory) {
      try {
        const parsedHistory: PaymentLinkHistory[] = JSON.parse(savedHistory);
        setState(prev => ({ ...prev, paymentLinks: parsedHistory }));
      } catch (error) {
        console.error('Error loading payment link history:', error);
      }
    }
  }, []);

  // Save to localStorage whenever paymentLinks changes
  const saveHistory = useCallback((links: PaymentLinkHistory[]) => {
    localStorage.setItem('quitamais-history', JSON.stringify(links));
  }, []);

  return {
    ...state,
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