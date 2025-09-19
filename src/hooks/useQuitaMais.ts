import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
      // Create payment link using Supabase Edge Function
      const { data: paymentLink, error } = await supabase.functions.invoke('quitamais-payment-link', {
        body: {
          ...request,
          orderType
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro ao criar link de pagamento');
      }

      if (!paymentLink) {
        throw new Error('Resposta inválida do servidor');
      }

      // Save to database and add to local history
      const { data: savedLink, error: saveError } = await supabase
        .from('payment_links')
        .insert({
          link_id: paymentLink.linkId,
          link_url: paymentLink.linkUrl,
          guid: paymentLink.guid,
          amount: request.amount,
          payer_name: request.payer.name,
          payer_email: request.payer.email,
          payer_document: request.payer.document,
          payer_phone_number: request.payer.phoneNumber,
          order_type: orderType,
          order_id: request.orderId,
          description: request.description,
          installments: request.checkout.installments,
          mask_fee: request.checkout.maskFee,
          creditor_name: request.bankslip?.creditorName,
          creditor_document: request.bankslip?.creditorDocument,
          expiration_date: request.expirationDate ? new Date(request.expirationDate).toISOString() : null,
          status: paymentLink.status
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving payment link:', saveError);
        // Continue anyway, don't fail the whole operation
      }

      const historyItem: PaymentLinkHistory = {
        id: savedLink?.id || crypto.randomUUID(),
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
      const { data: linkDetails, error } = await supabase.functions.invoke('quitamais-link-search', {
        body: { linkId }
      });
      
      if (error) {
        throw new Error(error.message || 'Erro ao consultar link de pagamento');
      }
      
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

  const loadHistory = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { data: links, error } = await supabase
        .from('payment_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const historyItems: PaymentLinkHistory[] = (links || []).map(link => ({
        id: link.id,
        linkId: link.link_id,
        linkUrl: link.link_url,
        amount: link.amount,
        payerName: link.payer_name,
        payerEmail: link.payer_email,
        status: link.status,
        createdAt: link.created_at,
        orderId: link.order_id,
        description: link.description
      }));

      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        paymentLinks: historyItems 
      }));
    } catch (error) {
      console.error('Error loading payment link history:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      
      // Fallback to localStorage
      const savedHistory = localStorage.getItem('quitamais-history');
      if (savedHistory) {
        try {
          const parsedHistory: PaymentLinkHistory[] = JSON.parse(savedHistory);
          setState(prev => ({ ...prev, paymentLinks: parsedHistory }));
        } catch (parseError) {
          console.error('Error parsing localStorage history:', parseError);
        }
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