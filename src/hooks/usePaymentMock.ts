import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface PaymentSplit {
  method: 'PIX' | 'CARD' | 'QUITA' | 'BOLETO';
  amount: number;
  percentage: number;
  installments?: number;
  maskFee?: boolean;
}

export function usePaymentMock() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const processSplits = async (splits: PaymentSplit[]) => {
    setLoading(true);
    
    // Mock processing delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Simular diferentes status de pagamento (90% aprovado, 5% pendente, 5% recusado)
    const random = Math.random();
    let status: 'approved' | 'pending' | 'failed';
    
    if (random < 0.90) {
      status = 'approved';
    } else if (random < 0.95) {
      status = 'pending';
    } else {
      status = 'failed';
    }
    
    // Mock transaction IDs
    const mockTransactionIds = splits.map(split => 
      `${split.method}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );

    setLoading(false);
    
    console.log('[usePaymentMock] Simulated payment status:', status);

    // Toasts baseados no status
    if (status === 'approved') {
      toast({
        title: "Pagamento aprovado!",
        description: `${splits.length} método(s) de pagamento processados com sucesso.`
      });
    } else if (status === 'pending') {
      toast({
        title: "Pagamento pendente",
        description: "Aguardando confirmação do pagamento...",
        variant: "default",
      });
    } else {
      toast({
        title: "Pagamento recusado",
        description: "Não foi possível processar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    }

    return {
      success: status === 'approved',
      status,
      transactionIds: mockTransactionIds,
      processedAt: new Date().toISOString()
    };
  };

  return {
    loading,
    processSplits
  };
}