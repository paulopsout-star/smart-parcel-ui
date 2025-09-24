import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckoutOptionCard } from '@/components/CheckoutOptionCard';
import { CheckoutSummary } from '@/components/CheckoutSummary';
import { SplitModal } from '@/components/SplitModal';
import { useCheckoutStore } from '@/hooks/useCheckoutStore';
import { getCheckoutCharge } from '@/hooks/useCheckoutMocks';
import { calculatePaymentOptions } from '@/lib/checkout-utils';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Shield, Lock } from 'lucide-react';

export interface PaymentOption {
  id: string;
  title: string;
  type: 'single' | 'popular' | 'minimum' | 'custom';
  totalCents: number;
  installments: number;
  installmentValueCents: number;
  discountCents?: number;
  isCustom?: boolean;
}

const Checkout = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { 
    charge, 
    selectedOption, 
    customAmount, 
    customInstallments,
    isSplitModalOpen,
    setCharge, 
    setSelectedOption, 
    setCustomAmount, 
    setCustomInstallments,
    setSplitModalOpen 
  } = useCheckoutStore();

  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<PaymentOption[]>([]);

  useEffect(() => {
    const loadCharge = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 500)); // Mock latency
        
        const chargeData = await getCheckoutCharge(id);
        if (!chargeData) {
          toast({
            title: "Erro",
            description: "Cobrança não encontrada",
            variant: "destructive"
          });
          return;
        }

        setCharge(chargeData);
        const paymentOptions = calculatePaymentOptions(chargeData.totalCents);
        setOptions(paymentOptions);
        
        // Auto-select popular option
        const popularOption = paymentOptions.find(opt => opt.type === 'popular');
        if (popularOption) {
          setSelectedOption(popularOption);
        }
      } catch (error) {
        console.error('Error loading charge:', error);
        toast({
          title: "Erro",
          description: "Falha ao carregar dados da cobrança",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadCharge();
  }, [id, setCharge, setSelectedOption, toast]);

  const handleCustomValueChange = (amountCents: number, installments: number) => {
    setCustomAmount(amountCents);
    setCustomInstallments(installments);
    
    // Create custom option
    if (amountCents > 0 && installments > 0) {
      const customOption: PaymentOption = {
        id: 'custom',
        title: 'Valor Personalizado',
        type: 'custom',
        totalCents: amountCents,
        installments,
        installmentValueCents: Math.floor(amountCents / installments),
        isCustom: true
      };
      
      setSelectedOption(customOption);
    }
  };

  const handleContinueToCheckout = () => {
    if (selectedOption) {
      setSplitModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!charge) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-ink mb-4">Cobrança não encontrada</h2>
          <p className="text-ink-secondary">Verifique o link e tente novamente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Payment Options - Left Side */}
          <div className="lg:col-span-2 space-y-4">
            <p className="text-ink-secondary text-sm mb-6">
              Selecione a opção que melhor se adequa ao seu perfil
            </p>
            
            {options.map((option) => (
              <CheckoutOptionCard
                key={option.id}
                option={option}
                isSelected={selectedOption?.id === option.id}
                onSelect={() => setSelectedOption(option)}
                onCustomValueChange={option.isCustom ? handleCustomValueChange : undefined}
                customAmount={customAmount}
                customInstallments={customInstallments}
              />
            ))}
            
            {/* Security Badge at Bottom */}
            <div className="flex items-center gap-2 mt-8 text-sm text-ink-secondary">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Lock className="w-3 h-3 text-primary" />
              </div>
              <div>
                <div className="font-medium text-ink">Pagamento 100% Seguro</div>
                <div className="text-xs">Seus dados são protegidos por criptografia SSL</div>
              </div>
            </div>
          </div>

          {/* Summary Sidebar - Right Side */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <CheckoutSummary
                charge={charge}
                selectedOption={selectedOption}
                onContinue={handleContinueToCheckout}
                disabled={!selectedOption}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Split Modal */}
      <SplitModal
        isOpen={isSplitModalOpen}
        onClose={() => setSplitModalOpen(false)}
        totalCents={selectedOption?.totalCents || 0}
        chargeId={id || ''}
      />
    </div>
  );
};

export default Checkout;