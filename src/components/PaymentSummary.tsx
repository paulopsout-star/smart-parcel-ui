import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PaymentSummaryProps {
  productName: string;
  productPrice: string;
  selectedOption: {
    amount: string;
    installments?: number;
    discount?: string;
  } | null;
}

export function PaymentSummary({
  productName,
  productPrice,
  selectedOption,
}: PaymentSummaryProps) {
  const calculateTotal = () => {
    if (!selectedOption) return productPrice;
    
    const installmentValue = parseFloat(
      selectedOption.amount.replace("R$ ", "").replace(".", "").replace(",", ".")
    );
    
    if (selectedOption.installments) {
      return `R$ ${(installmentValue * selectedOption.installments).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    
    return selectedOption.amount;
  };

  return (
    <Card className="p-6 bg-muted/30 border-muted">
      <h3 className="font-semibold text-lg mb-4 text-card-foreground">
        Resumo do Pagamento
      </h3>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">{productName}</span>
          <span className="font-medium text-card-foreground">{productPrice}</span>
        </div>
        
        {selectedOption && (
          <>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Forma de pagamento</span>
              <div className="text-right">
                <div className="font-medium text-card-foreground">
                  {selectedOption.amount}
                  {selectedOption.installments && (
                    <span className="text-sm text-muted-foreground ml-1">
                      em {selectedOption.installments}x
                    </span>
                  )}
                </div>
                {selectedOption.discount && (
                  <div className="text-sm text-success">
                    {selectedOption.discount}
                  </div>
                )}
              </div>
            </div>
            
            <Separator />
            <div className="flex justify-between items-center font-semibold text-lg">
              <span className="text-card-foreground">Total</span>
              <span className="text-primary">{calculateTotal()}</span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}