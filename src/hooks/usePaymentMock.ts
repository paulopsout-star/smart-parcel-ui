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
    
    // Mock success response
    const mockTransactionIds = splits.map(split => 
      `${split.method}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );

    setLoading(false);
    
    toast({
      title: "Splits processados!",
      description: `${splits.length} método(s) de pagamento configurados com sucesso.`
    });

    return {
      success: true,
      transactionIds: mockTransactionIds,
      processedAt: new Date().toISOString()
    };
  };

  return {
    loading,
    processSplits
  };
}