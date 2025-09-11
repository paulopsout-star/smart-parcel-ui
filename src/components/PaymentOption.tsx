import { Check, TrendingUp, Clock, Zap, Edit3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PaymentOptionProps {
  type: "min-installment" | "single-payment" | "popular" | "custom";
  title: string;
  description: string;
  amount: string;
  installments?: number;
  discount?: string;
  isSelected: boolean;
  onSelect: () => void;
  customValue?: string;
  onCustomValueChange?: (value: string) => void;
  badge?: string;
}

const getIcon = (type: string) => {
  switch (type) {
    case "min-installment":
      return <Clock className="w-6 h-6 text-primary" />;
    case "single-payment":
      return <Zap className="w-6 h-6 text-success" />;
    case "popular":
      return <TrendingUp className="w-6 h-6 text-warning" />;
    case "custom":
      return <Edit3 className="w-6 h-6 text-accent-foreground" />;
    default:
      return null;
  }
};

export function PaymentOption({
  type,
  title,
  description,
  amount,
  installments,
  discount,
  isSelected,
  onSelect,
  customValue,
  onCustomValueChange,
  badge,
}: PaymentOptionProps) {
  return (
    <Card
      className={cn(
        "relative p-6 cursor-pointer transition-all duration-300 hover:shadow-lg border-2",
        "hover:border-payment-selected/20 hover:bg-payment-hover",
        isSelected
          ? "border-payment-selected bg-payment-selected/5 shadow-lg"
          : "border-payment-border bg-payment-card"
      )}
      onClick={onSelect}
    >
      {badge && (
        <div className="absolute -top-3 left-6 px-3 py-1 bg-warning text-warning-foreground text-sm font-medium rounded-full">
          {badge}
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getIcon(type)}
          <div>
            <h3 className="font-semibold text-lg text-card-foreground">
              {title}
            </h3>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>

        {isSelected && (
          <div className="w-6 h-6 bg-payment-selected rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        {type === "custom" ? (
          <div className="space-y-3">
            <Input
              type="text"
              placeholder="R$ 0,00"
              value={customValue}
              onChange={(e) => onCustomValueChange?.(e.target.value)}
              className="text-xl font-bold"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-sm text-muted-foreground">
              Digite o valor da parcela desejada
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-card-foreground">
                {amount}
              </span>
              {installments && (
                <span className="text-muted-foreground">
                  em {installments}x
                </span>
              )}
            </div>

            {discount && (
              <div className="text-success font-medium text-sm">
                {discount}
              </div>
            )}

            {installments && (
              <p className="text-sm text-muted-foreground">
                Total: R$ {(parseFloat(amount.replace("R$ ", "").replace(".", "").replace(",", ".")) * installments).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}