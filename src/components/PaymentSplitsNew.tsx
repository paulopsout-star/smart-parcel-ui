import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, QrCode, Receipt, Banknote, Loader2, Save, RotateCcw, FileText, AlertTriangle, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PaymentMethod {
  id: 'PIX' | 'CARD' | 'QUITA' | 'BOLETO';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  amount: number;
  percentage: number;
  minAmount?: number;
  installments?: number;
  maskFee?: boolean;
}

interface PaymentSplitsNewProps {
  totalAmount: number; // in cents
  onSplitsChange?: (splits: PaymentMethod[]) => void;
  onValidChange?: (isValid: boolean) => void;
  className?: string;
  disabled?: boolean;
}

interface SplitTemplate {
  id: string;
  name: string;
  splits: Omit<PaymentMethod, 'enabled' | 'amount' | 'percentage'>[];
}

const DEFAULT_TEMPLATES: SplitTemplate[] = [
  {
    id: 'pix-only',
    name: 'PIX Único',
    splits: [{ id: 'PIX', label: 'PIX', icon: QrCode }]
  },
  {
    id: 'card-only',
    name: 'Cartão Único',
    splits: [{ id: 'CARD', label: 'Cartão', icon: CreditCard, installments: 1, maskFee: false }]
  },
  {
    id: 'pix-card-50-50',
    name: 'PIX + Cartão (50/50)',
    splits: [
      { id: 'PIX', label: 'PIX', icon: QrCode },
      { id: 'CARD', label: 'Cartão', icon: CreditCard, installments: 1, maskFee: false }
    ]
  },
  {
    id: 'quita-boleto',
    name: 'Quita+ com Boleto',
    splits: [
      { id: 'QUITA', label: 'Quita+', icon: Receipt },
      { id: 'BOLETO', label: 'Boleto', icon: Banknote }
    ]
  }
];

export function PaymentSplitsNew({ 
  totalAmount, 
  onSplitsChange, 
  onValidChange, 
  className, 
  disabled = false 
}: PaymentSplitsNewProps) {
  const [splitType, setSplitType] = useState<'percentage' | 'amount'>('percentage');
  const [methods, setMethods] = useState<PaymentMethod[]>([
    { id: 'PIX', label: 'PIX', icon: QrCode, enabled: false, amount: 0, percentage: 0 },
    { id: 'CARD', label: 'Cartão', icon: CreditCard, enabled: true, amount: totalAmount, percentage: 100, installments: 1, maskFee: false },
    { id: 'QUITA', label: 'Quita+', icon: Receipt, enabled: false, amount: 0, percentage: 0 },
    { id: 'BOLETO', label: 'Boleto', icon: Banknote, enabled: false, amount: 0, percentage: 0, minAmount: 500 } // Min R$ 5,00
  ]);
  const [isDraft, setIsDraft] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Calculate totals and validation
  const totals = useMemo(() => {
    const enabledMethods = methods.filter(m => m.enabled);
    const totalPercentage = enabledMethods.reduce((sum, m) => sum + m.percentage, 0);
    const totalAmountCalc = enabledMethods.reduce((sum, m) => sum + m.amount, 0);
    
    const isValidPercentage = Math.abs(totalPercentage - 100) < 0.01;
    const isValidAmount = Math.abs(totalAmountCalc - totalAmount) < 1; // 1 cent tolerance
    const hasEnabledMethods = enabledMethods.length > 0;
    const validMinAmounts = enabledMethods.every(m => !m.minAmount || m.amount >= m.minAmount);
    
    const isValid = hasEnabledMethods && 
      (splitType === 'percentage' ? isValidPercentage : isValidAmount) &&
      validMinAmounts;

    return {
      percentage: totalPercentage,
      amount: totalAmountCalc,
      isValid,
      enabledMethods,
      errors: {
        noMethods: !hasEnabledMethods,
        invalidSum: splitType === 'percentage' ? !isValidPercentage : !isValidAmount,
        minAmounts: !validMinAmounts
      }
    };
  }, [methods, splitType, totalAmount]);

  // Update parent when splits or validity changes
  useEffect(() => {
    onSplitsChange?.(methods.filter(m => m.enabled));
    onValidChange?.(totals.isValid);
  }, [methods, totals.isValid, onSplitsChange, onValidChange]);

  // Update calculations when split type or total amount changes
  useEffect(() => {
    setMethods(prevMethods => {
      return prevMethods.map(method => {
        if (!method.enabled) return method;
        
        if (splitType === 'percentage') {
          return {
            ...method,
            amount: Math.round((method.percentage / 100) * totalAmount)
          };
        } else {
          return {
            ...method,
            percentage: totalAmount > 0 ? (method.amount / totalAmount) * 100 : 0
          };
        }
      });
    });
  }, [splitType, totalAmount]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const parseCurrency = (value: string): number => {
    const numericValue = value.replace(/[^\d,]/g, '').replace(',', '.');
    return Math.round(parseFloat(numericValue || '0') * 100);
  };

  const handleMethodToggle = (methodId: PaymentMethod['id'], enabled: boolean) => {
    if (disabled) return;
    
    setMethods(prevMethods => {
      const updatedMethods = prevMethods.map(method => {
        if (method.id === methodId) {
          const newMethod = { ...method, enabled };
          
          if (enabled && splitType === 'percentage') {
            // Auto-distribute remaining percentage
            const otherEnabledMethods = prevMethods.filter(m => m.enabled && m.id !== methodId);
            const totalOtherPercentage = otherEnabledMethods.reduce((sum, m) => sum + m.percentage, 0);
            const remainingPercentage = Math.max(0, 100 - totalOtherPercentage);
            
            newMethod.percentage = remainingPercentage;
            newMethod.amount = Math.round((remainingPercentage / 100) * totalAmount);
          } else if (enabled && splitType === 'amount') {
            // Auto-distribute remaining amount
            const otherEnabledMethods = prevMethods.filter(m => m.enabled && m.id !== methodId);
            const totalOtherAmount = otherEnabledMethods.reduce((sum, m) => sum + m.amount, 0);
            const remainingAmount = Math.max(0, totalAmount - totalOtherAmount);
            
            newMethod.amount = remainingAmount;
            newMethod.percentage = totalAmount > 0 ? (remainingAmount / totalAmount) * 100 : 0;
          } else if (!enabled) {
            newMethod.percentage = 0;
            newMethod.amount = 0;
          }
          
          return newMethod;
        }
        return method;
      });

      return updatedMethods;
    });
    
    setIsDraft(true);
  };

  const handleValueChange = (methodId: PaymentMethod['id'], value: number, type: 'percentage' | 'amount') => {
    if (disabled) return;
    
    setMethods(prevMethods => {
      return prevMethods.map(method => {
        if (method.id === methodId && method.enabled) {
          const updatedMethod = { ...method };
          
          if (type === 'percentage') {
            updatedMethod.percentage = Math.min(100, Math.max(0, value));
            updatedMethod.amount = Math.round((updatedMethod.percentage / 100) * totalAmount);
          } else {
            updatedMethod.amount = Math.min(totalAmount, Math.max(0, value));
            updatedMethod.percentage = totalAmount > 0 ? (updatedMethod.amount / totalAmount) * 100 : 0;
          }
          
          return updatedMethod;
        }
        return method;
      });
    });
    
    setIsDraft(true);
  };

  const handleInstallmentsChange = (methodId: PaymentMethod['id'], installments: number) => {
    if (disabled) return;
    
    setMethods(prevMethods => {
      return prevMethods.map(method => {
        if (method.id === methodId) {
          return { ...method, installments };
        }
        return method;
      });
    });
    
    setIsDraft(true);
  };

  const handleMaskFeeToggle = (methodId: PaymentMethod['id'], maskFee: boolean) => {
    if (disabled) return;
    
    setMethods(prevMethods => {
      return prevMethods.map(method => {
        if (method.id === methodId) {
          return { ...method, maskFee };
        }
        return method;
      });
    });
    
    setIsDraft(true);
  };

  const applyTemplate = (template: SplitTemplate) => {
    if (disabled) return;
    
    setMethods(prevMethods => {
      return prevMethods.map(method => {
        const templateMethod = template.splits.find(t => t.id === method.id);
        
        if (templateMethod) {
          const percentage = 100 / template.splits.length;
          const amount = Math.round((percentage / 100) * totalAmount);
          
          return {
            ...method,
            enabled: true,
            percentage,
            amount,
            installments: templateMethod.installments || method.installments,
            maskFee: templateMethod.maskFee || method.maskFee
          };
        } else {
          return {
            ...method,
            enabled: false,
            percentage: 0,
            amount: 0
          };
        }
      });
    });
    
    setIsDraft(true);
    
    toast({
      title: "Template aplicado",
      description: `Template "${template.name}" foi aplicado com sucesso.`
    });
  };

  const saveDraft = async () => {
    if (disabled) return;
    
    setIsLoading(true);
    
    // Mock save delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setIsDraft(false);
    setIsLoading(false);
    
    toast({
      title: "Rascunho salvo",
      description: "Configuração de splits salva como rascunho."
    });
  };

  const clearAll = () => {
    if (disabled) return;
    
    setMethods(prevMethods => {
      return prevMethods.map(method => ({
        ...method,
        enabled: method.id === 'CARD', // Keep only CARD enabled by default
        percentage: method.id === 'CARD' ? 100 : 0,
        amount: method.id === 'CARD' ? totalAmount : 0,
        installments: 1,
        maskFee: false
      }));
    });
    
    setIsDraft(true);
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Split de Pagamentos
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={totals.isValid ? "default" : "destructive"}>
              {totals.isValid ? (
                <><Check className="w-3 h-3 mr-1" />Válido</>
              ) : (
                <><AlertTriangle className="w-3 h-3 mr-1" />Inválido</>
              )}
            </Badge>
            {isDraft && (
              <Badge variant="secondary">
                <Save className="w-3 h-3 mr-1" />
                Rascunho
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">Valor Total:</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Soma Atual:</span>
              <span className={cn(
                "font-medium",
                totals.errors.invalidSum ? "text-destructive" : "text-muted-foreground"
              )}>
                {splitType === 'percentage' 
                  ? `${totals.percentage.toFixed(1)}%` 
                  : formatCurrency(totals.amount)
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span>Métodos Ativos:</span>
              <span>{totals.enabledMethods.length}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Tipo de Split:</Label>
            <RadioGroup
              value={splitType}
              onValueChange={(value: 'percentage' | 'amount') => setSplitType(value)}
              className="flex gap-4"
              disabled={disabled}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="percentage" id="percentage" />
                <Label htmlFor="percentage">Porcentagem (%)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="amount" id="amount" />
                <Label htmlFor="amount">Valor (R$)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Templates */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Templates Rápidos:</Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_TEMPLATES.map(template => (
                <Button
                  key={template.id}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(template)}
                  disabled={disabled}
                  className="text-xs"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  {template.name}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* Payment Methods */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Métodos de Pagamento:</Label>
          
          {methods.map(method => {
            const Icon = method.icon;
            const hasError = method.enabled && method.minAmount && method.amount < method.minAmount;
            
            return (
              <div
                key={method.id}
                className={cn(
                  "border rounded-lg p-4 transition-all",
                  method.enabled ? "border-primary bg-primary/5" : "border-muted",
                  hasError && "border-destructive bg-destructive/5"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={method.enabled}
                      onCheckedChange={(enabled) => handleMethodToggle(method.id, enabled)}
                      disabled={disabled}
                    />
                    <Icon className={cn(
                      "w-5 h-5",
                      method.enabled ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "font-medium",
                      method.enabled ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {method.label}
                    </span>
                  </div>
                  
                  {method.enabled && (
                    <Badge variant="outline" className="text-xs">
                      {splitType === 'percentage' 
                        ? `${method.percentage.toFixed(1)}%`
                        : formatCurrency(method.amount)
                      }
                    </Badge>
                  )}
                </div>

                {method.enabled && (
                  <div className="space-y-3">
                    {/* Value Input */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`${method.id}-percentage`} className="text-xs">
                          Porcentagem (%)
                        </Label>
                        <Input
                          id={`${method.id}-percentage`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={method.percentage.toFixed(1)}
                          onChange={(e) => handleValueChange(method.id, parseFloat(e.target.value) || 0, 'percentage')}
                          disabled={disabled || splitType === 'amount'}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`${method.id}-amount`} className="text-xs">
                          Valor (centavos)
                        </Label>
                        <Input
                          id={`${method.id}-amount`}
                          type="number"
                          min="0"
                          max={totalAmount}
                          value={method.amount}
                          onChange={(e) => handleValueChange(method.id, parseInt(e.target.value) || 0, 'amount')}
                          disabled={disabled || splitType === 'percentage'}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* Method-specific options */}
                    {method.id === 'CARD' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`${method.id}-installments`} className="text-xs">
                            Parcelas
                          </Label>
                          <Select
                            value={method.installments?.toString()}
                            onValueChange={(value) => handleInstallmentsChange(method.id, parseInt(value))}
                            disabled={disabled}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                                <SelectItem key={num} value={num.toString()}>
                                  {num}x
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`${method.id}-maskfee`}
                              checked={method.maskFee || false}
                              onCheckedChange={(maskFee) => handleMaskFeeToggle(method.id, maskFee)}
                              disabled={disabled}
                            />
                            <Label htmlFor={`${method.id}-maskfee`} className="text-xs">
                              Mascarar Taxa
                            </Label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Min amount warning */}
                    {hasError && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Valor mínimo para {method.label}: {formatCurrency(method.minAmount!)}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Validation Errors */}
        {!totals.isValid && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {totals.errors.noMethods && "Selecione pelo menos um método de pagamento. "}
              {totals.errors.invalidSum && `A soma deve ser igual a ${splitType === 'percentage' ? '100%' : formatCurrency(totalAmount)}. `}
              {totals.errors.minAmounts && "Alguns métodos estão abaixo do valor mínimo."}
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={disabled}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={saveDraft}
              disabled={disabled || isLoading || !isDraft}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar Rascunho
            </Button>
          </div>
        </div>

        {/* Live Preview */}
        {totals.enabledMethods.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-base font-medium">Preview dos Splits:</Label>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="space-y-2">
                  {totals.enabledMethods.map(method => {
                    const Icon = method.icon;
                    return (
                      <div key={method.id} className="flex items-center justify-between py-2 px-3 bg-background rounded border">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">{method.label}</span>
                          {method.id === 'CARD' && method.installments && method.installments > 1 && (
                            <Badge variant="outline" className="text-xs">
                              {method.installments}x
                            </Badge>
                          )}
                          {method.maskFee && (
                            <Badge variant="outline" className="text-xs">
                              Taxa Mascarada
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(method.amount)}</div>
                          <div className="text-xs text-muted-foreground">{method.percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <Separator className="my-3" />
                
                <div className="flex items-center justify-between font-bold">
                  <span>Total:</span>
                  <span className={cn(
                    totals.isValid ? "text-primary" : "text-destructive"
                  )}>
                    {formatCurrency(totals.amount)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}