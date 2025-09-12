import { useState } from "react";
import { ArrowLeft, CreditCard, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentOption } from "@/components/PaymentOption";
import { PaymentSummary } from "@/components/PaymentSummary";
import { useToast } from "@/hooks/use-toast";
import autonegocie from "@/assets/autonegocie-logo.jpg";

type PaymentOptionType = "min-installment" | "single-payment" | "popular" | "custom";

export default function Payment() {
  const [selectedOption, setSelectedOption] = useState<PaymentOptionType | null>(null);
  const [customValue, setCustomValue] = useState("");
  const { toast } = useToast();

  const productName = "Curso de Desenvolvimento Web Completo";
  const productPrice = "R$ 997,00";

  const paymentOptions = [
    {
      type: "min-installment" as PaymentOptionType,
      title: "Menor Parcela",
      description: "Parcele em mais vezes e pague menos por mês",
      amount: "R$ 83,08",
      installments: 12,
    },
    {
      type: "single-payment" as PaymentOptionType,
      title: "Pagamento único",
      description: "Pagamento único com desconto especial",
      amount: "R$ 797,60",
      discount: "Economize R$ 199,40",
    },
    {
      type: "popular" as PaymentOptionType,
      title: "Parcelamento Popular",
      description: "A opção mais escolhida pelos nossos clientes",
      amount: "R$ 166,17",
      installments: 6,
      badge: "Mais Escolhido",
    },
    {
      type: "custom" as PaymentOptionType,
      title: "Valor Personalizado",
      description: "Escolha o valor da parcela que cabe no seu bolso",
      amount: customValue || "R$ 0,00",
    },
  ];

  const getSelectedOptionDetails = () => {
    const option = paymentOptions.find(opt => opt.type === selectedOption);
    if (!option) return null;
    
    return {
      amount: option.type === "custom" ? customValue || "R$ 0,00" : option.amount,
      installments: option.installments,
      discount: option.discount,
    };
  };

  const handleConfirmPayment = () => {
    if (!selectedOption) {
      toast({
        title: "Selecione uma opção",
        description: "Por favor, escolha uma forma de pagamento para continuar.",
        variant: "destructive",
      });
      return;
    }

    if (selectedOption === "custom" && !customValue.trim()) {
      toast({
        title: "Valor inválido",
        description: "Por favor, digite um valor para a parcela personalizada.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Redirecionando...",
      description: "Você será direcionado para a página de checkout.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <div className="flex flex-col items-center gap-2">
              <img 
                src={autonegocie} 
                alt="Auto Negocie" 
                className="h-8"
              />
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-semibold">Escolha sua forma de pagamento</h1>
              </div>
            </div>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Payment Options */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Opções de Pagamento</h2>
                <p className="text-muted-foreground mb-6">
                  Selecione a opção que melhor se adequa ao seu perfil
                </p>
              </div>

              <div className="space-y-4">
                {paymentOptions.map((option) => (
                  <PaymentOption
                    key={option.type}
                    type={option.type}
                    title={option.title}
                    description={option.description}
                    amount={option.amount}
                    installments={option.installments}
                    discount={option.discount}
                    badge={option.badge}
                    isSelected={selectedOption === option.type}
                    onSelect={() => setSelectedOption(option.type)}
                    customValue={customValue}
                    onCustomValueChange={setCustomValue}
                  />
                ))}
              </div>

              {/* Security Info */}
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border">
                <Shield className="w-5 h-5 text-success" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Pagamento 100% Seguro</p>
                  <p className="text-xs text-muted-foreground">
                    Seus dados são protegidos por criptografia SSL
                  </p>
                </div>
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* Payment Summary */}
            <div className="space-y-6">
              <PaymentSummary
                productName={productName}
                productPrice={productPrice}
                selectedOption={getSelectedOptionDetails()}
              />

              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all duration-300"
                onClick={handleConfirmPayment}
                disabled={!selectedOption}
              >
                Continuar para o Checkout
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Ao continuar, você concorda com nossos{" "}
                <a href="#" className="text-primary hover:underline">
                  Termos de Uso
                </a>{" "}
                e{" "}
                <a href="#" className="text-primary hover:underline">
                  Política de Privacidade
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}