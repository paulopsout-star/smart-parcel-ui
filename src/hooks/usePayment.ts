import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { PaymentFormData, PaymentResponse, PaymentState } from '@/types/payment';

export function usePayment() {
  const [paymentState, setPaymentState] = useState<PaymentState>({
    isProcessing: false,
    isSuccess: false,
    error: null,
    transactionId: null,
  });

  const { toast } = useToast();

  const processPayment = async (
    formData: PaymentFormData,
    amount: number,
    installments: number
  ): Promise<PaymentResponse> => {
    setPaymentState({
      isProcessing: true,
      isSuccess: false,
      error: null,
      transactionId: null,
    });

    try {
      // Chama a edge function do Supabase
      const response = await fetch('https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYmJya2JleXhzcXFqcWhwdHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODk5NTQsImV4cCI6MjA3Mzg2NTk1NH0.I5l0SDwsAN_rsSdoZiE9GAndkn3tkqX44O5ypu0cu7w`,
        },
        body: JSON.stringify({
          ...formData,
          amountInCents: Math.round(amount * 100),
          installments,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: PaymentResponse = await response.json();

      if (result.success) {
        setPaymentState({
          isProcessing: false,
          isSuccess: true,
          error: null,
          transactionId: result.transactionId || null,
        });

        toast({
          title: "Pagamento Autorizado!",
          description: `Transação processada com sucesso. ID: ${result.transactionId}`,
        });
      } else {
        throw new Error(result.message || 'Erro no processamento do pagamento');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setPaymentState({
        isProcessing: false,
        isSuccess: false,
        error: errorMessage,
        transactionId: null,
      });

      toast({
        title: "Erro no Pagamento",
        description: errorMessage,
        variant: "destructive",
      });

      return {
        success: false,
        message: errorMessage,
      };
    }
  };

  const resetPaymentState = () => {
    setPaymentState({
      isProcessing: false,
      isSuccess: false,
      error: null,
      transactionId: null,
    });
  };

  return {
    paymentState,
    processPayment,
    resetPaymentState,
  };
}