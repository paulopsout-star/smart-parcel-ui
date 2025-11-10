import { useState } from "react";
import { CreditCard, User, Mail, Phone, Calendar, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { PaymentFormData, PaymentState } from "@/types/payment";

interface PaymentFormProps {
  amount: number;
  installments: number;
  productName: string;
  chargeId?: string;
  paymentLinkId?: string;
  hasBoleto?: boolean;
  boletoLinhaDigitavel?: string;
  creditorDocument?: string;
  creditorName?: string;
  onSuccess?: (transactionId: string) => void;
  onCancel?: () => void;
  skipSplitCheck?: boolean;
  disableSubmit?: boolean;
  initialPayerData?: {
    name?: string;
    email?: string;
    document?: string;
    phone?: string;
  };
}

export function PaymentForm({
  amount,
  installments,
  productName,
  chargeId,
  paymentLinkId,
  hasBoleto = false,
  boletoLinhaDigitavel,
  creditorDocument,
  creditorName,
  onSuccess,
  onCancel,
  skipSplitCheck = false,
  disableSubmit = false,
  initialPayerData,
}: PaymentFormProps) {
  const { toast } = useToast();
  
  const [paymentState, setPaymentState] = useState<PaymentState>({
    isProcessing: false,
    isSuccess: false,
    error: null,
    transactionId: null,
  });
  
  const [formData, setFormData] = useState<PaymentFormData>({
    payerName: initialPayerData?.name || "",
    payerDocument: initialPayerData?.document || "",
    payerEmail: initialPayerData?.email || "",
    payerPhoneNumber: initialPayerData?.phone || "",
    cardHolderName: "",
    cardNumber: "",
    cardExpirationDate: "",
    cardCvv: "",
  });

  const [errors, setErrors] = useState<Partial<PaymentFormData>>({});

  const formatCardNumber = (value: string) => {
    return value
      .replace(/\s/g, '')
      .replace(/(\d{4})/g, '$1 ')
      .trim()
      .slice(0, 19); // Máximo 16 dígitos + 3 espaços
  };

  const formatDocument = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const formatExpirationDate = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length >= 2) {
      return numbers.slice(0, 2) + '/' + numbers.slice(2, 4);
    }
    return numbers;
  };

  const handleInputChange = (field: keyof PaymentFormData, value: string) => {
    let formattedValue = value;

    switch (field) {
      case 'cardNumber':
        formattedValue = formatCardNumber(value);
        break;
      case 'payerDocument':
        formattedValue = formatDocument(value);
        break;
      case 'payerPhoneNumber':
        formattedValue = formatPhone(value);
        break;
      case 'cardExpirationDate':
        formattedValue = formatExpirationDate(value);
        break;
      case 'cardCvv':
        formattedValue = value.replace(/\D/g, '').slice(0, 4);
        break;
    }

    setFormData(prev => ({ ...prev, [field]: formattedValue }));
    
    // Remove erro quando usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<PaymentFormData> = {};

    if (!formData.payerName.trim()) newErrors.payerName = "Nome é obrigatório";
    if (!formData.payerDocument.trim()) newErrors.payerDocument = "CPF/CNPJ é obrigatório";
    if (!formData.payerEmail.trim()) newErrors.payerEmail = "E-mail é obrigatório";
    if (!formData.payerPhoneNumber.trim()) newErrors.payerPhoneNumber = "Telefone é obrigatório";
    if (!formData.cardHolderName.trim()) newErrors.cardHolderName = "Nome no cartão é obrigatório";
    if (!formData.cardNumber.trim()) newErrors.cardNumber = "Número do cartão é obrigatório";
    if (!formData.cardExpirationDate.trim()) newErrors.cardExpirationDate = "Data de validade é obrigatória";
    if (!formData.cardCvv.trim()) newErrors.cardCvv = "CVV é obrigatório";

    // Validações específicas
    // Validações específicas
    if (formData.payerEmail && !/\S+@\S+\.\S+/.test(formData.payerEmail)) {
      newErrors.payerEmail = "E-mail inválido";
    }

    // Validação CPF/CNPJ
    if (formData.payerDocument) {
      const numbers = formData.payerDocument.replace(/\D/g, '');
      if (numbers.length !== 11 && numbers.length !== 14) {
        newErrors.payerDocument = "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos";
      }
    }

    // Validação do telefone
    if (formData.payerPhoneNumber) {
      const numbers = formData.payerPhoneNumber.replace(/\D/g, '');
      if (numbers.length < 10 || numbers.length > 11) {
        newErrors.payerPhoneNumber = "Telefone deve ter 10 ou 11 dígitos";
      }
    }

    // Validação CPF/CNPJ
    if (formData.payerDocument) {
      const numbers = formData.payerDocument.replace(/\D/g, '');
      if (numbers.length !== 11 && numbers.length !== 14) {
        newErrors.payerDocument = "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos";
      }
    }

    // Validação do telefone
    if (formData.payerPhoneNumber) {
      const numbers = formData.payerPhoneNumber.replace(/\D/g, '');
      if (numbers.length < 10 || numbers.length > 11) {
        newErrors.payerPhoneNumber = "Telefone deve ter 10 ou 11 dígitos";
      }
    }

    if (formData.cardNumber && formData.cardNumber.replace(/\s/g, '').length < 16) {
      newErrors.cardNumber = "Número do cartão deve ter 16 dígitos";
    }

    if (formData.cardExpirationDate && !/^\d{2}\/\d{2}$/.test(formData.cardExpirationDate)) {
      newErrors.cardExpirationDate = "Formato inválido (MM/AA)";
    }

    if (formData.cardCvv && (formData.cardCvv.length < 3 || formData.cardCvv.length > 4)) {
      newErrors.cardCvv = "CVV deve ter 3 ou 4 dígitos";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    if (!chargeId || !paymentLinkId) {
      toast({
        title: "Erro",
        description: "Dados do pagamento incompletos. Por favor, tente novamente.",
        variant: "destructive",
      });
      return;
    }

    setPaymentState({
      isProcessing: true,
      isSuccess: false,
      error: null,
      transactionId: null,
    });

    try {
      console.log('[PaymentForm] Iniciando pré-pagamento Quita+...');
      console.log('[PaymentForm] Dados:', {
        amount: Math.round(amount * 100),
        installments,
        hasBoleto,
        hasLinhaDigitavel: !!boletoLinhaDigitavel
      });

      // ETAPA 1: Pré-pagamento (autorização do cartão)
      const { data: prePaymentData, error: prePaymentError } = await supabase.functions.invoke(
        'quitaplus-prepayment',
        {
          body: {
            chargeId,
            paymentLinkId,
            amount: Math.round(amount * 100),
            installments,
            card: {
              holderName: formData.cardHolderName,
              number: formData.cardNumber.replace(/\s/g, ''),
              expirationDate: formData.cardExpirationDate.replace('/', ''),
              cvv: formData.cardCvv,
            },
            payer: {
              name: formData.payerName,
              document: formData.payerDocument.replace(/\D/g, ''),
              email: formData.payerEmail,
              phoneNumber: formData.payerPhoneNumber.replace(/\D/g, ''),
            },
          },
        }
      );

      if (prePaymentError) {
        console.error('[PaymentForm] Erro no pré-pagamento:', prePaymentError);
        throw new Error(prePaymentError.message || 'Falha ao autorizar cartão');
      }

      if (prePaymentData?.error) {
        const errorMessage = prePaymentData.message || prePaymentData.error || 'Cartão recusado';
        console.error('[PaymentForm] Cartão recusado:', errorMessage);
        toast({
          title: "Cartão recusado",
          description: errorMessage,
          variant: "destructive",
        });
        setPaymentState({
          isProcessing: false,
          isSuccess: false,
          error: errorMessage,
          transactionId: null,
        });
        return;
      }

      const prePaymentKey = prePaymentData?.prePaymentKey;
      if (!prePaymentKey) {
        throw new Error('Chave de pré-pagamento não retornada pela API');
      }

      console.log('[PaymentForm] Cartão autorizado! PrePaymentKey:', prePaymentKey);

      // Debug: Verificar condições para vincular boleto
      console.log('[PaymentForm] 🔍 Verificando condições para vincular boleto:', {
        hasBoleto,
        temLinhaDigitavel: !!boletoLinhaDigitavel,
        comprimentoLinha: boletoLinhaDigitavel?.length,
        temCreditorDocument: !!creditorDocument,
        creditorDocument: creditorDocument ? '***' + creditorDocument.slice(-4) : 'VAZIO',
        temCreditorName: !!creditorName,
        creditorName: creditorName || 'VAZIO'
      });

      console.log('[PaymentForm] 🔍 Verificando condições para vincular boleto:', {
        hasBoleto,
        temLinhaDigitavel: !!boletoLinhaDigitavel,
        comprimentoLinha: boletoLinhaDigitavel?.length,
        temCreditorDocument: !!creditorDocument,
        creditorDocument: creditorDocument ? '***' + creditorDocument.slice(-4) : 'VAZIO',
        temCreditorName: !!creditorName,
        creditorName: creditorName || 'VAZIO'
      });

      // ETAPA 2: Vincular boleto (se existir)
      if (hasBoleto && boletoLinhaDigitavel && creditorDocument && creditorName) {
        console.log('[PaymentForm] ✅ Vinculando boleto ao pré-pagamento...');
        console.log('[PaymentForm] Vinculando boleto à autorização...');

        const { data: linkData, error: linkError } = await supabase.functions.invoke(
          'quitaplus-link-boleto',
          {
            body: {
              prePaymentKey,
              paymentLinkId,
              boleto: {
                number: boletoLinhaDigitavel.replace(/\D/g, ''),
                creditorDocument: creditorDocument.replace(/\D/g, ''),
                creditorName,
              },
            },
          }
        );

        if (linkError) {
          console.error('[PaymentForm] Erro ao vincular boleto:', linkError);
          throw new Error(linkError.message || 'Falha ao vincular boleto');
        }

        if (linkData?.error) {
          const errorMessage = linkData.message || linkData.error || 'Erro ao vincular boleto';
          console.error('[PaymentForm] Boleto não vinculado:', errorMessage);
          toast({
            title: "Erro ao vincular boleto",
            description: errorMessage,
            variant: "destructive",
          });
          setPaymentState({
            isProcessing: false,
            isSuccess: false,
            error: errorMessage,
            transactionId: null,
          });
          return;
        }

        console.log('[PaymentForm] Boleto vinculado com sucesso!');
      }

      // ETAPA 3: Sucesso total
      const transactionId = prePaymentData?.transactionId || prePaymentKey;
      
      console.log('[PaymentForm] ✅ Pagamento concluído:', {
        transactionId,
        boletoVinculado: hasBoleto && boletoLinhaDigitavel
      });

      setPaymentState({
        isProcessing: false,
        isSuccess: true,
        error: null,
        transactionId,
      });

      toast({
        title: "Pagamento autorizado!",
        description: hasBoleto 
          ? `Cartão autorizado e boleto vinculado com sucesso!`
          : `Transação processada com sucesso em ${installments}x.`,
      });

      onSuccess?.(transactionId);

    } catch (error) {
      console.error('[PaymentForm] Erro fatal:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar pagamento';
      
      toast({
        title: "Erro no pagamento",
        description: errorMessage,
        variant: "destructive",
      });

      setPaymentState({
        isProcessing: false,
        isSuccess: false,
        error: errorMessage,
        transactionId: null,
      });
    }
  };

  if (paymentState.isSuccess) {
    return (
      <Card className="p-8 text-center">
        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-success" />
        </div>
        <h3 className="text-xl font-semibold text-card-foreground mb-2">
          Pagamento Autorizado!
        </h3>
        <p className="text-muted-foreground mb-4">
          Sua transação foi processada com sucesso.
        </p>
        <p className="text-sm text-muted-foreground">
          ID da transação: {paymentState.transactionId}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6 lg:mb-8">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-xl lg:text-2xl font-bold text-card-foreground">
            Dados para Pagamento
          </h3>
          <p className="text-sm text-muted-foreground">Preencha os dados abaixo para concluir</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-8">
        {/* Dados do Pagador */}
        <div className="bg-muted/30 rounded-lg p-5 lg:p-6 space-y-4">
          <h4 className="text-base lg:text-lg font-bold text-card-foreground mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Dados Pessoais
          </h4>
          <div className="space-y-4">
            <div>
              <Label htmlFor="payerName">Nome Completo</Label>
              <Input
                id="payerName"
                value={formData.payerName}
                onChange={(e) => handleInputChange('payerName', e.target.value)}
                placeholder="Seu nome completo"
                className={errors.payerName ? "border-destructive" : ""}
              />
              {errors.payerName && (
                <p className="text-sm text-destructive mt-1">{errors.payerName}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="payerDocument">CPF/CNPJ</Label>
              <Input
                id="payerDocument"
                value={formData.payerDocument}
                onChange={(e) => handleInputChange('payerDocument', e.target.value)}
                placeholder="000.000.000-00"
                className={errors.payerDocument ? "border-destructive" : ""}
              />
              {errors.payerDocument && (
                <p className="text-sm text-destructive mt-1">{errors.payerDocument}</p>
              )}
            </div>

            <div>
              <Label htmlFor="payerEmail">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="payerEmail"
                  type="email"
                  value={formData.payerEmail}
                  onChange={(e) => handleInputChange('payerEmail', e.target.value)}
                  placeholder="seu@email.com"
                  className={`pl-10 ${errors.payerEmail ? "border-destructive" : ""}`}
                />
              </div>
              {errors.payerEmail && (
                <p className="text-sm text-destructive mt-1">{errors.payerEmail}</p>
              )}
            </div>

            <div>
              <Label htmlFor="payerPhoneNumber">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="payerPhoneNumber"
                  value={formData.payerPhoneNumber}
                  onChange={(e) => handleInputChange('payerPhoneNumber', e.target.value)}
                  placeholder="(11) 99999-9999"
                  className={`pl-10 ${errors.payerPhoneNumber ? "border-destructive" : ""}`}
                />
              </div>
              {errors.payerPhoneNumber && (
                <p className="text-sm text-destructive mt-1">{errors.payerPhoneNumber}</p>
              )}
            </div>
          </div>
        </div>

        {/* Dados do Cartão */}
        <div className="bg-muted/30 rounded-lg p-5 lg:p-6 space-y-4">
          <h4 className="text-base lg:text-lg font-bold text-card-foreground mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Dados do Cartão
          </h4>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cardHolderName" className="text-sm font-medium">Nome no Cartão</Label>
              <Input
                id="cardHolderName"
                value={formData.cardHolderName}
                onChange={(e) => handleInputChange('cardHolderName', e.target.value)}
                placeholder="Nome como está no cartão"
                className={`h-11 ${errors.cardHolderName ? "border-destructive" : ""}`}
              />
              {errors.cardHolderName && (
                <p className="text-sm text-destructive mt-1">{errors.cardHolderName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardNumber" className="text-sm font-medium">Número do Cartão</Label>
              <Input
                id="cardNumber"
                value={formData.cardNumber}
                onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                className={`h-11 ${errors.cardNumber ? "border-destructive" : ""}`}
              />
              {errors.cardNumber && (
                <p className="text-sm text-destructive mt-1">{errors.cardNumber}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cardExpirationDate" className="text-sm font-medium">Validade</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="cardExpirationDate"
                    value={formData.cardExpirationDate}
                    onChange={(e) => handleInputChange('cardExpirationDate', e.target.value)}
                    placeholder="MM/AA"
                    maxLength={5}
                    className={`h-11 pl-10 ${errors.cardExpirationDate ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.cardExpirationDate && (
                  <p className="text-sm text-destructive mt-1">{errors.cardExpirationDate}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardCvv" className="text-sm font-medium">CVV</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="cardCvv"
                    value={formData.cardCvv}
                    onChange={(e) => handleInputChange('cardCvv', e.target.value)}
                    placeholder="123"
                    maxLength={4}
                    className={`h-11 pl-10 ${errors.cardCvv ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.cardCvv && (
                  <p className="text-sm text-destructive mt-1">{errors.cardCvv}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resumo e Ações - Sticky */}
        <div className="lg:sticky lg:top-4 space-y-4">
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-5 lg:p-6 rounded-lg">
            <h5 className="text-sm font-semibold text-card-foreground mb-3 uppercase tracking-wide">Resumo do Pagamento</h5>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{productName}</span>
                <span className="font-medium">R$ {amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Parcelamento</span>
                <span className="font-medium">
                  {installments}x de R$ {(amount / installments).toFixed(2)}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center pt-1">
                <span className="font-semibold text-base">Total</span>
                <span className="font-bold text-xl text-primary">
                  R$ {amount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={paymentState.isProcessing}
                className="flex-1 h-12"
              >
                Cancelar
              </Button>
            )}
            
            <Button
              type="submit"
              disabled={paymentState.isProcessing || disableSubmit}
              className="flex-1 h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg hover:shadow-xl transition-all"
            >
              {paymentState.isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent mr-2" />
                  Processando...
                </>
              ) : disableSubmit ? (
                "Selecione uma opção de pagamento"
              ) : (
                "Pagar Agora"
              )}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}