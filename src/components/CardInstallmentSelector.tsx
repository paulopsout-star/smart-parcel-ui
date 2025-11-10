import { useState, useEffect } from 'react';
import { CheckoutOptionCard } from '@/components/CheckoutOptionCard';
import { PaymentOption } from '@/types/payment-options';
import { calculatePaymentOptions } from '@/lib/checkout-utils';

interface CardInstallmentSelectorProps {
  cardAmountCents: number;
  selectedInstallments: number;
  onInstallmentsChange: (installments: number) => void;
}

export function CardInstallmentSelector({
  cardAmountCents,
  selectedInstallments,
  onInstallmentsChange,
}: CardInstallmentSelectorProps) {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customAmount, setCustomAmount] = useState(cardAmountCents);
  const [customInstallments, setCustomInstallments] = useState(selectedInstallments);

  // Gerar opções baseadas no valor do cartão
  const options = calculatePaymentOptions(cardAmountCents);

  // Mapear opção selecionada para installments
  useEffect(() => {
    const option = options.find(opt => opt.id === selectedOption);
    if (option && !option.isCustom) {
      onInstallmentsChange(option.installments);
    }
  }, [selectedOption, options, onInstallmentsChange]);

  // Sincronizar seleção inicial com selectedInstallments
  useEffect(() => {
    const matchingOption = options.find(
      opt => opt.installments === selectedInstallments && !opt.isCustom
    );
    if (matchingOption) {
      setSelectedOption(matchingOption.id);
    }
  }, [selectedInstallments, options]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground mb-2">
        Selecione o parcelamento para o cartão
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option) => (
          <CheckoutOptionCard
            key={option.id}
            option={option}
            isSelected={selectedOption === option.id}
            onSelect={() => setSelectedOption(option.id)}
            onCustomValueChange={
              option.isCustom 
                ? (desiredCents) => {
                    // Para este componente, usamos lógica local sem simulação
                    setCustomAmount(desiredCents);
                    setCustomInstallments(1);
                    onInstallmentsChange(1);
                  }
                : undefined
            }
            customResult={
              option.isCustom && selectedOption === option.id
                ? {
                    installments: customInstallments,
                    totalCents: customAmount,
                    installmentValueCents: Math.floor(customAmount / customInstallments)
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
