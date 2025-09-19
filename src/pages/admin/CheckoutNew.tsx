import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Copy, ExternalLink, Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useQuitaMais } from "@/hooks/useQuitaMais";
import { PaymentLinkRequest, OrderType } from "@/types/quitamais";
import { formatAmount, formatCurrency } from "@/lib/quitamais-validation";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const formSchema = z.object({
  amount: z.string().min(1, "Valor é obrigatório"),
  // Payer
  payerName: z.string().min(1, "Nome é obrigatório").max(200, "Nome deve ter no máximo 200 caracteres"),
  payerEmail: z.string().email("Email inválido").max(50, "Email deve ter no máximo 50 caracteres"),
  payerPhone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos").max(11, "Telefone deve ter no máximo 11 dígitos"),
  payerDocument: z.string().min(11, "Documento inválido"),
  // Bankslip (optional)
  useBankslip: z.boolean(),
  bankslipNumber: z.string().optional(),
  creditorDocument: z.string().optional(),
  creditorName: z.string().optional(),
  // Checkout
  maskFee: z.boolean(),
  installments: z.string(),
  // Metadata
  description: z.string().optional(),
  orderId: z.string().optional(),
  orderType: z.enum(["boleto", "credit_card", "pix", "bank_transfer"]),
});

interface FormData {
  amount: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  payerDocument: string;
  useBankslip: boolean;
  bankslipNumber?: string;
  creditorDocument?: string;
  creditorName?: string;
  maskFee: boolean;
  installments: string;
  description?: string;
  orderId?: string;
  orderType: OrderType;
}

export default function CheckoutNew() {
  const [generatedLink, setGeneratedLink] = useState<{
    linkUrl: string;
    linkId: string;
    guid: string;
  } | null>(null);

  const { createPaymentLink, isLoading, copyToClipboard, shareViaWhatsApp, shareViaEmail, testConnectivity } = useQuitaMais();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      maskFee: true,
      installments: "12",
      orderType: "boleto",
      useBankslip: false
    }
  });

  const watchMaskFee = watch("maskFee");
  const watchUseBankslip = watch("useBankslip");
  const watchAmount = watch("amount");

  const onSubmit = async (data: FormData) => {
    try {
      const request: PaymentLinkRequest = {
        amount: formatAmount(data.amount),
        payer: {
          name: data.payerName,
          email: data.payerEmail,
          phoneNumber: data.payerPhone.replace(/\D/g, ''),
          document: data.payerDocument.replace(/\D/g, '')
        },
        checkout: {
          maskFee: data.maskFee,
          installments: data.installments ? parseInt(data.installments) : null
        },
        description: data.description || undefined,
        orderId: data.orderId || undefined
      };

      if (data.useBankslip) {
        request.bankslip = {
          number: data.bankslipNumber.replace(/\D/g, ''),
          creditorDocument: data.creditorDocument.replace(/\D/g, ''),
          creditorName: data.creditorName
        };
      }

      const result = await createPaymentLink(request, data.orderType);
      
      if (result) {
        setGeneratedLink({
          linkUrl: result.linkUrl,
          linkId: result.linkId,
          guid: result.guid
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao criar link",
        description: "Verifique os dados e tente novamente.",
        variant: "destructive"
      });
    }
  };

  if (generatedLink) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setGeneratedLink(null)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Link de Pagamento Gerado</h1>
                <p className="text-muted-foreground">
                  Seu link foi criado com sucesso!
                </p>
              </div>
            </div>

            {/* Success Card */}
            <Card>
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ExternalLink className="w-8 h-8 text-success" />
                </div>
                <CardTitle className="text-success">Link Criado com Sucesso!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Link Details */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">URL do Checkout</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={generatedLink.linkUrl}
                        readOnly
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(generatedLink.linkUrl)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">ID do Link</Label>
                      <div className="mt-1">
                        <Badge variant="secondary">{generatedLink.linkId}</Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">GUID</Label>
                      <div className="mt-1">
                        <Badge variant="outline">{generatedLink.guid}</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(generatedLink.linkUrl)}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar Link
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => shareViaWhatsApp(generatedLink.linkUrl)}
                    className="gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    WhatsApp
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => shareViaEmail(generatedLink.linkUrl)}
                    className="gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Email
                  </Button>
                </div>

                <Button
                  className="w-full"
                  onClick={() => window.open(generatedLink.linkUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir Link de Pagamento
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Gerar Link de Checkout</h1>
                <p className="text-muted-foreground">
                  Crie um link de pagamento personalizado para seus clientes
                </p>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              onClick={testConnectivity}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <div className="w-4 h-4 rounded-full bg-success" />
              )}
              Testar Conectividade
            </Button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Main Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Valor e Tipo */}
                <Card>
                  <CardHeader>
                    <CardTitle>Configurações do Pagamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="amount">Valor *</Label>
                        <Input
                          id="amount"
                          placeholder="R$ 0,00"
                          {...register("amount")}
                          className={errors.amount ? "border-destructive" : ""}
                        />
                        {errors.amount && (
                          <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>
                        )}
                        {watchAmount && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Valor: {formatCurrency(formatAmount(watchAmount))}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="orderType">Tipo de Pagamento</Label>
                        <Controller
                          control={control}
                          name="orderType"
                          render={({ field }) => (
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="boleto">Boleto</SelectItem>
                                <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                                <SelectItem value="pix">PIX</SelectItem>
                                <SelectItem value="bank_transfer">Transferência</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Dados do Pagador */}
                <Card>
                  <CardHeader>
                    <CardTitle>Dados do Pagador</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="payerName">Nome Completo *</Label>
                        <Input
                          id="payerName"
                          placeholder="Nome do pagador"
                          {...register("payerName")}
                          className={errors.payerName ? "border-destructive" : ""}
                        />
                        {errors.payerName && (
                          <p className="text-sm text-destructive mt-1">{errors.payerName.message}</p>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="payerEmail">Email *</Label>
                        <Input
                          id="payerEmail"
                          type="email"
                          placeholder="email@exemplo.com"
                          {...register("payerEmail")}
                          className={errors.payerEmail ? "border-destructive" : ""}
                        />
                        {errors.payerEmail && (
                          <p className="text-sm text-destructive mt-1">{errors.payerEmail.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="payerPhone">Telefone *</Label>
                        <Input
                          id="payerPhone"
                          placeholder="11999999999"
                          {...register("payerPhone")}
                          className={errors.payerPhone ? "border-destructive" : ""}
                        />
                        {errors.payerPhone && (
                          <p className="text-sm text-destructive mt-1">{errors.payerPhone.message}</p>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="payerDocument">CPF/CNPJ *</Label>
                        <Input
                          id="payerDocument"
                          placeholder="000.000.000-00"
                          {...register("payerDocument")}
                          className={errors.payerDocument ? "border-destructive" : ""}
                        />
                        {errors.payerDocument && (
                          <p className="text-sm text-destructive mt-1">{errors.payerDocument.message}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Configurações de Parcelamento */}
                <Card>
                  <CardHeader>
                    <CardTitle>Parcelamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={control}
                        name="maskFee"
                        render={({ field }) => (
                          <Checkbox
                            id="maskFee"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <Label htmlFor="maskFee">
                        Parcelas fechadas (cliente não pode alterar)
                      </Label>
                    </div>

                    {watchMaskFee && (
                      <div>
                        <Label htmlFor="installments">Número de Parcelas</Label>
                        <Controller
                          control={control}
                          name="installments"
                          render={({ field }) => (
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1x à vista</SelectItem>
                                {Array.from({ length: 47 }, (_, i) => i + 2).map((num) => (
                                  <SelectItem key={num} value={num.toString()}>
                                    {num}x
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Boleto (Opcional) */}
                <Card>
                  <CardHeader>
                    <CardTitle>Configurações de Boleto</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={control}
                        name="useBankslip"
                        render={({ field }) => (
                          <Checkbox
                            id="useBankslip"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <Label htmlFor="useBankslip">
                        Incluir dados do boleto
                      </Label>
                    </div>

                    {watchUseBankslip && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="bankslipNumber">Linha Digitável</Label>
                          <Input
                            id="bankslipNumber"
                            placeholder="Apenas números"
                            {...register("bankslipNumber")}
                            className={errors.bankslipNumber ? "border-destructive" : ""}
                          />
                          {errors.bankslipNumber && (
                            <p className="text-sm text-destructive mt-1">{errors.bankslipNumber.message}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="creditorDocument">Documento do Credor</Label>
                            <Input
                              id="creditorDocument"
                              placeholder="CPF/CNPJ do credor"
                              {...register("creditorDocument")}
                              className={errors.creditorDocument ? "border-destructive" : ""}
                            />
                            {errors.creditorDocument && (
                              <p className="text-sm text-destructive mt-1">{errors.creditorDocument.message}</p>
                            )}
                          </div>
                          
                          <div>
                            <Label htmlFor="creditorName">Nome do Credor</Label>
                            <Input
                              id="creditorName"
                              placeholder="Nome do credor"
                              {...register("creditorName")}
                              className={errors.creditorName ? "border-destructive" : ""}
                            />
                            {errors.creditorName && (
                              <p className="text-sm text-destructive mt-1">{errors.creditorName.message}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Metadados */}
                <Card>
                  <CardHeader>
                    <CardTitle>Informações Adicionais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        placeholder="Descrição do pagamento..."
                        {...register("description")}
                        className={errors.description ? "border-destructive" : ""}
                      />
                      {errors.description && (
                        <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="orderId">ID do Pedido</Label>
                      <Input
                        id="orderId"
                        placeholder="Referência interna"
                        {...register("orderId")}
                        className={errors.orderId ? "border-destructive" : ""}
                      />
                      {errors.orderId && (
                        <p className="text-sm text-destructive mt-1">{errors.orderId.message}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Resumo */}
                <Card>
                  <CardHeader>
                    <CardTitle>Resumo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor:</span>
                      <span className="font-medium">
                        {watchAmount ? formatCurrency(formatAmount(watchAmount)) : "R$ 0,00"}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parcelas:</span>
                      <span className="font-medium">
                        {watchMaskFee ? `${watch("installments")}x` : "Em aberto"}
                      </span>
                    </div>

                    <Separator />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Gerando Link...
                        </>
                      ) : (
                        "Gerar Link de Checkout"
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Ambiente */}
                <Card>
                  <CardHeader>
                    <CardTitle>Ambiente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">Sandbox</Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      Links gerados em ambiente de teste
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}