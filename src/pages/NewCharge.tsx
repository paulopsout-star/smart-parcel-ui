import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Receipt, Banknote, Wallet, Calculator, CreditCard, QrCode } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { CheckoutSuccessModal } from '@/components/CheckoutSuccessModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { FormSection } from '@/components/forms/FormSection';
import { FormField } from '@/components/forms/FormField';
import { SummaryCard } from '@/components/forms/SummaryCard';
import { FieldSkeleton } from '@/components/forms/FieldSkeleton';
import { formatPhone, formatDocument, unformatPhone, unformatDocument } from '@/lib/input-masks';
import { cn } from '@/lib/utils';
import { SimulatorModal } from '@/components/SimulatorModal';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

const formSchema = z.object({
  payer_name: z.string().min(1, "Nome é obrigatório").max(200, "Nome deve ter no máximo 200 caracteres"),
  payer_email: z.string().email("Email inválido"),
  payer_phone: z.string()
    .min(1, "Telefone é obrigatório")
    .refine((val) => {
      const digits = val.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 11;
    }, {
      message: "Telefone deve ter 10 ou 11 dígitos"
    }),
  payer_document: z.string()
    .min(1, "CPF/CNPJ é obrigatório")
    .refine((val) => {
      const digits = val.replace(/\D/g, '');
      return digits.length === 11 || digits.length === 14;
    }, {
      message: "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos"
    }),
  payment_method: z.enum(["pix", "cartao", "cartao_pix"]).default("cartao"),
  amount: z.string().min(1, "Valor é obrigatório"),
  pix_amount: z.string().optional(),
  card_amount: z.string().optional(),
  description: z.string().optional(),
  installments: z.string(),
  mask_fee: z.boolean(),
  has_boleto: z.boolean(),
  boleto_barcode: z.string().optional(),
  message_template_id: z.string().optional(),
  boleto_linha_digitavel: z.string().optional(),
  recurrence_type: z.enum(["pontual", "diaria", "semanal", "quinzenal", "mensal", "semestral", "anual"]),
  recurrence_interval: z.string(),
  recurrence_end_date: z.string().optional(),
}).superRefine((data, ctx) => {
  // Linha digitável obrigatória (47 dígitos) para cartão e cartao_pix
  if (data.payment_method === 'cartao' || data.payment_method === 'cartao_pix') {
    if (!data.boleto_linha_digitavel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Linha digitável é obrigatória para pagamento com cartão",
        path: ["boleto_linha_digitavel"],
      });
    } else {
      const digits = data.boleto_linha_digitavel.replace(/\D/g, '');
      if (digits.length !== 47) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Linha digitável deve ter exatamente 47 dígitos",
          path: ["boleto_linha_digitavel"],
        });
      }
    }
  }
  
  // Validar split de valores para cartao_pix
  if (data.payment_method === 'cartao_pix') {
    if (!data.pix_amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Valor do PIX é obrigatório",
        path: ["pix_amount"],
      });
    }
    if (!data.card_amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Valor do Cartão é obrigatório",
        path: ["card_amount"],
      });
    }
  }
});

interface FormData {
  payer_name: string;
  payer_email: string;
  payer_phone: string;
  payer_document: string;
  payment_method: "pix" | "cartao" | "cartao_pix";
  amount: string;
  pix_amount?: string;
  card_amount?: string;
  description?: string;
  installments: string;
  mask_fee: boolean;
  has_boleto: boolean;
  boleto_barcode?: string;
  message_template_id?: string;
  boleto_linha_digitavel?: string;
  recurrence_type: "pontual" | "diaria" | "semanal" | "quinzenal" | "mensal" | "semestral" | "anual";
  recurrence_interval: string;
  recurrence_end_date?: string;
}

export default function NewCharge() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasPayoutAccount, setHasPayoutAccount] = useState(false);
  const [checkingPayoutAccount, setCheckingPayoutAccount] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [enableSplit, setEnableSplit] = useState(false);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  
  const { 
    data: creditorSettings, 
    isLoading: settingsLoading, 
    isValid: isSettingsValid 
  } = useCompanySettings();
  const [checkoutData, setCheckoutData] = useState<{
    chargeId: string;
    checkoutUrl: string;
    linkId: string;
    amount: number;
    payerName: string;
    description?: string;
    status: 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO';
  } | null>(null);
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { data: messageTemplates = [], isLoading: loadingTemplates, isError: templatesError } = useMessageTemplates(profile?.id);

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      payment_method: "cartao",
      mask_fee: false,
      has_boleto: false,
      installments: "1",
      recurrence_type: "pontual",
      recurrence_interval: "1"
    }
  });

  const watchRecurrenceType = watch("recurrence_type");
  const watchAmount = watch("amount");
  const watchHasBoleto = watch("has_boleto");
  const watchBoletoLinhaDigitavel = watch("boleto_linha_digitavel");
  const watchPayerName = watch("payer_name");
  const watchPaymentMethod = watch("payment_method");
  const watchPixAmount = watch("pix_amount");
  const watchCardAmount = watch("card_amount");

  useEffect(() => {
    if (!profile) return;
    
    const checkPayoutAccount = async () => {
      setCheckingPayoutAccount(true);
      try {
        const { data: payoutData, error: payoutError } = await supabase
          .from('payout_accounts')
          .select('id')
          .eq('user_id', profile.id)
          .eq('is_active', true)
          .limit(1);

        if (payoutError) throw payoutError;
        setHasPayoutAccount((payoutData ?? []).length > 0);
      } catch (error) {
        console.error('[NewCharge] ❌ Erro ao verificar conta de pagamento:', error);
      } finally {
        setCheckingPayoutAccount(false);
      }
    };

    checkPayoutAccount();
  }, [profile]);

  const formatAmount = (value: string) => {
    const numericValue = parseFloat(
      value.replace(/[^\d.,]/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
    );
    return Math.round(numericValue * 100);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const calculateNextChargeDate = (recurrenceType: string, interval: number = 1) => {
    const now = new Date();
    const utcNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    
    switch (recurrenceType) {
      case 'pontual':
        return null;
      case 'diaria':
        return new Date(utcNow.getTime() + (interval * 24 * 60 * 60 * 1000));
      case 'semanal':
        return new Date(utcNow.getTime() + (interval * 7 * 24 * 60 * 60 * 1000));
      case 'quinzenal':
        return new Date(utcNow.getTime() + (interval * 14 * 24 * 60 * 60 * 1000));
      case 'mensal':
        const nextMonth = new Date(utcNow);
        nextMonth.setMonth(nextMonth.getMonth() + interval);
        return nextMonth;
      case 'semestral':
        const nextSemester = new Date(utcNow);
        nextSemester.setMonth(nextSemester.getMonth() + (interval * 6));
        return nextSemester;
      case 'anual':
        const nextYear = new Date(utcNow);
        nextYear.setFullYear(nextYear.getFullYear() + interval);
        return nextYear;
      default:
        return null;
    }
  };

  const normalizeBoletoLinhaDigitavel = (linha: string) => {
    return linha.replace(/\D/g, '');
  };

  const onSubmit = async (data: FormData) => {
    console.log('✅ Iniciando criação de cobrança:', {
      tipo: data.recurrence_type,
      valor: data.amount,
      pagador: data.payer_name
    });
    
    if (!profile) return;
    
    if (!isSettingsValid) {
      toast({
        title: 'Configurações da empresa ausentes',
        description: 'Atualize a página e tente novamente. Se o problema persistir, entre em contato com o suporte.',
        variant: 'destructive'
      });
      return;
    }
    
    if (data.recurrence_type !== 'pontual' && !data.has_boleto && !hasPayoutAccount) {
      setError('Para cobranças recorrentes sem boleto, é necessário ter uma conta PIX cadastrada.');
      toast({
        title: "Conta PIX necessária",
        description: "Cadastre uma conta PIX em 'Contas PIX' antes de criar cobranças recorrentes sem boleto.",
        variant: 'destructive'
      });
      return;
    }
    
    // Log para debug
    if (data.payment_method === 'cartao' || data.payment_method === 'cartao_pix') {
      console.log('ui.newcharge.cartao.boleto_obrigatorio:', data.boleto_linha_digitavel ? 'preenchido' : 'vazio');
    }
    
    setIsLoading(true);
    setError("");

    try {
      let amountInCents = formatAmount(data.amount);
      let feeAmount = 0;
      let feePercentage = 0;
      
      if (data.payment_method === 'pix') {
        feeAmount = Math.round(amountInCents * 0.03);
        feePercentage = 3.00;
        amountInCents = amountInCents + feeAmount;
      }
      
      const interval = parseInt(data.recurrence_interval) || 1;
      const nextChargeDate = calculateNextChargeDate(data.recurrence_type, interval);

      let messageTemplateSnapshot = null;
      if (data.message_template_id && data.message_template_id !== "none") {
        const { data: template } = await supabase
          .from('message_templates')
          .select('*')
          .eq('id', data.message_template_id)
          .single();
        
        if (template) {
          messageTemplateSnapshot = {
            id: template.id,
            name: template.name ?? '',
            content: template.content ?? '',
            variables: template.variables ?? []
          };
        }
      }

      const normalizedLinhaDigitavel = data.boleto_linha_digitavel 
        ? normalizeBoletoLinhaDigitavel(data.boleto_linha_digitavel)
        : null;

      // Linha digitável é obrigatória para cartão e cartao_pix
      const requiresBoleto = data.payment_method === 'cartao' || data.payment_method === 'cartao_pix';
      
      if (requiresBoleto && normalizedLinhaDigitavel) {
        console.log('Backend: boleto_linha_digitavel saved', {
          length: normalizedLinhaDigitavel.length,
          hash_prefix: normalizedLinhaDigitavel.substring(0, 8)
        });
      }

      const { data: charge, error: chargeError } = await supabase
        .from('charges')
        .insert({
          company_id: profile.company_id,
          created_by: profile.id,
          payer_name: data.payer_name,
          payer_email: data.payer_email,
          payer_document: unformatDocument(data.payer_document),
          payer_phone: unformatPhone(data.payer_phone),
          amount: amountInCents,
          description: data.description || null,
          payment_method: data.payment_method,
          installments: parseInt(data.installments),
          mask_fee: data.mask_fee,
          has_boleto: data.has_boleto,
          boleto_barcode: data.boleto_barcode || null,
          has_boleto_link: requiresBoleto, // Agora é true se for cartão ou cartao_pix
          boleto_linha_digitavel: requiresBoleto ? normalizedLinhaDigitavel : null,
          pix_amount: data.payment_method === 'cartao_pix' ? formatAmount(data.pix_amount || '0') : null,
          card_amount: data.payment_method === 'cartao_pix' ? formatAmount(data.card_amount || '0') : null,
          creditor_document: creditorSettings?.creditor_document || null,
          creditor_name: creditorSettings?.creditor_name || null,
          message_template_id: data.message_template_id === "none" ? null : data.message_template_id,
          message_template_snapshot: messageTemplateSnapshot,
          recurrence_type: data.recurrence_type,
          recurrence_interval: interval,
          recurrence_end_date: data.recurrence_end_date ? new Date(data.recurrence_end_date).toISOString() : null,
          next_charge_date: nextChargeDate?.toISOString() || null,
          fee_amount: feeAmount,
          fee_percentage: feePercentage,
          metadata: {
            created_via: 'web_interface',
            user_agent: navigator.userAgent,
            original_amount: data.payment_method === 'pix' ? formatAmount(data.amount) : undefined
          }
        })
        .select()
        .single();

      if (chargeError) {
        throw chargeError;
      }

      console.log('[NewCharge] Cobrança criada com sucesso no banco:', charge.id);

      if (data.payment_method === 'pix') {
        const checkoutUrl = `${window.location.origin}/checkout-pix/${charge.id}`;
        
        const fullCheckoutData = {
          chargeId: charge.id,
          checkoutUrl: checkoutUrl,
          linkId: charge.id,
          amount: charge.amount,
          payerName: charge.payer_name,
          description: charge.description || undefined,
          status: 'PENDENTE' as const
        };
        
        toast({
          title: "Cobrança PIX criada!",
          description: "Link de pagamento gerado com sucesso.",
        });
        
        setCheckoutData(fullCheckoutData);
        setShowCheckoutModal(true);
        return;
      }

      if (data.message_template_id && data.message_template_id !== "none" && messageTemplateSnapshot) {
        try {
          await supabase.functions.invoke('send-mock-message', {
            body: {
              chargeId: charge.id,
              templateContent: messageTemplateSnapshot.content,
              phoneNumber: data.payer_phone,
              payerName: data.payer_name,
              amount: amountInCents
            }
          });
        } catch (messageError) {
          console.error('Error sending mock message:', messageError);
        }
      }

      if (data.recurrence_type !== 'pontual' || data.has_boleto) {
        toast({
          title: "Cobrança criada com sucesso!",
          description: data.recurrence_type === 'pontual' 
            ? "Cobrança com boleto criada. O processamento será realizado quando a integração estiver ativa."
            : `Cobrança recorrente configurada (${data.recurrence_type}). O agendamento será processado quando a integração estiver ativa.`,
        });
        navigate('/charges');
        return;
      }

      if (requiresBoleto && normalizedLinhaDigitavel) {
        console.log('[NewCharge] ℹ️ Cobrança com boleto criada:', {
          chargeId: charge.id,
          temLinhaDigitavel: true,
          comprimentoLinha: normalizedLinhaDigitavel.length,
          creditorDocument: creditorSettings?.creditor_document,
          creditorName: creditorSettings?.creditor_name,
          info: 'O boleto será vinculado automaticamente no backend após autorização do cartão (quitaplus-prepayment)'
        });
      }

      console.log('[NewCharge] Gerando link de checkout para cobrança pontual...');
      if (data.recurrence_type === 'pontual' && !data.has_boleto) {
        try {
          console.log('[NewCharge] Gerando link de checkout via charge-links...');
          
          const { data: linkData, error: linkError } = await supabase.functions.invoke('charge-links', {
            body: { chargeId: charge.id, action: 'create' }
          });
          
          if (linkError) {
            console.error('[NewCharge] Erro ao invocar charge-links:', linkError);
            throw new Error(linkError.message || 'Falha ao gerar link');
          }
          
          if (!linkData?.link?.url) {
            console.error('[NewCharge] Link não retornado:', linkData);
            throw new Error('Link não foi gerado');
          }
          
          const fullCheckoutData = {
            chargeId: charge.id,
            checkoutUrl: linkData.link.url,
            linkId: linkData.link.id,
            amount: charge.amount,
            payerName: charge.payer_name,
            description: charge.description || undefined,
            status: 'PENDENTE' as const
          };

          toast({
            title: "Cobrança criada com sucesso!",
            description: "Link de checkout gerado.",
          });
          
          setCheckoutData(fullCheckoutData);
          setShowCheckoutModal(true);
          return;
          
        } catch (linkError: any) {
          console.error('[NewCharge] Erro ao criar link:', linkError);
          toast({
            title: "Cobrança criada",
            description: "Houve um problema ao gerar o link de checkout. Tente novamente pelo histórico.",
            variant: 'destructive'
          });
          navigate('/charges');
          return;
        }
      }

      toast({
        title: "Cobrança criada",
        description: "Cobrança registrada com sucesso!",
      });
      navigate('/charges');
      
    } catch (error: any) {
      console.error('Error creating charge:', error);
      setError(error.message);
      toast({
        title: "Erro ao criar cobrança",
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || checkingPayoutAccount) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-ds-text-strong">Nova Cobrança</h1>
          <p className="text-ds-text-muted">Crie uma nova cobrança para seus clientes</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Dados do Pagador */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-primary" />
                    Dados do Pagador
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payer_name">Nome Completo *</Label>
                      <Input
                        id="payer_name"
                        {...register("payer_name")}
                        placeholder="Nome do pagador"
                        className={errors.payer_name ? "border-destructive" : ""}
                      />
                      {errors.payer_name && (
                        <p className="text-sm text-destructive">{errors.payer_name.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="payer_email">Email *</Label>
                      <Input
                        id="payer_email"
                        type="email"
                        {...register("payer_email")}
                        placeholder="email@exemplo.com"
                        className={errors.payer_email ? "border-destructive" : ""}
                      />
                      {errors.payer_email && (
                        <p className="text-sm text-destructive">{errors.payer_email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payer_phone">Telefone *</Label>
                      <Controller
                        name="payer_phone"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            onChange={(e) => field.onChange(formatPhone(e.target.value))}
                            placeholder="(11) 99999-9999"
                            className={errors.payer_phone ? "border-destructive" : ""}
                          />
                        )}
                      />
                      {errors.payer_phone && (
                        <p className="text-sm text-destructive">{errors.payer_phone.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="payer_document">CPF/CNPJ *</Label>
                      <Controller
                        name="payer_document"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            onChange={(e) => field.onChange(formatDocument(e.target.value))}
                            placeholder="000.000.000-00"
                            className={errors.payer_document ? "border-destructive" : ""}
                          />
                        )}
                      />
                      {errors.payer_document && (
                        <p className="text-sm text-destructive">{errors.payer_document.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dados da Cobrança */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Receipt className="h-5 w-5 text-primary" />
                    Dados da Cobrança
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Valor *</Label>
                      <Input
                        id="amount"
                        {...register("amount")}
                        placeholder="R$ 0,00"
                        className={errors.amount ? "border-destructive" : ""}
                      />
                      {errors.amount && (
                        <p className="text-sm text-destructive">{errors.amount.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Método de Pagamento *</Label>
                      <Controller
                        name="payment_method"
                        control={control}
                        render={({ field }) => (
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="flex flex-wrap gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="cartao" id="cartao" />
                              <Label htmlFor="cartao" className="flex items-center gap-1.5 cursor-pointer">
                                <CreditCard className="h-4 w-4" />
                                Cartão
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="pix" id="pix" />
                              <Label htmlFor="pix" className="flex items-center gap-1.5 cursor-pointer">
                                <QrCode className="h-4 w-4" />
                                PIX
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="cartao_pix" id="cartao_pix" />
                              <Label htmlFor="cartao_pix" className="flex items-center gap-1.5 cursor-pointer">
                                <CreditCard className="h-4 w-4" />
                                <span>+</span>
                                <QrCode className="h-4 w-4" />
                                Cartão + PIX
                              </Label>
                            </div>
                          </RadioGroup>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="Descrição da cobrança (opcional)"
                      rows={3}
                    />
                  </div>

                  {(watchPaymentMethod === "cartao" || watchPaymentMethod === "cartao_pix") && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Parcelas</Label>
                        <Controller
                          name="installments"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {[1,2,3,4,5,6,7,8,9,10,11,12].map((i) => (
                                  <SelectItem key={i} value={i.toString()}>
                                    {i}x {i === 1 ? 'à vista' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="flex items-center space-x-2 pt-6">
                        <Controller
                          name="mask_fee"
                          control={control}
                          render={({ field }) => (
                            <Checkbox
                              id="mask_fee"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                        <Label htmlFor="mask_fee" className="text-sm cursor-pointer">
                          Ocultar taxa do pagador
                        </Label>
                      </div>
                    </div>
                  )}

                  {/* Split de valores para Cartão + PIX */}
                  {watchPaymentMethod === "cartao_pix" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-2">
                        <Label htmlFor="pix_amount">Valor PIX *</Label>
                        <Input
                          id="pix_amount"
                          {...register("pix_amount")}
                          placeholder="R$ 0,00"
                          className={errors.pix_amount ? "border-destructive" : ""}
                        />
                        {errors.pix_amount && (
                          <p className="text-sm text-destructive">{errors.pix_amount.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="card_amount">Valor Cartão *</Label>
                        <Input
                          id="card_amount"
                          {...register("card_amount")}
                          placeholder="R$ 0,00"
                          className={errors.card_amount ? "border-destructive" : ""}
                        />
                        {errors.card_amount && (
                          <p className="text-sm text-destructive">{errors.card_amount.message}</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Linha Digitável do Boleto - Obrigatória para Cartão e Cartão+PIX */}
              {(watchPaymentMethod === "cartao" || watchPaymentMethod === "cartao_pix") && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Banknote className="h-5 w-5 text-primary" />
                      Linha Digitável do Boleto *
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="boleto_linha_digitavel">Linha Digitável (47 dígitos) *</Label>
                      <Input
                        id="boleto_linha_digitavel"
                        {...register("boleto_linha_digitavel")}
                        placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                        className={errors.boleto_linha_digitavel ? "border-destructive" : ""}
                      />
                      {errors.boleto_linha_digitavel && (
                        <p className="text-sm text-destructive">{errors.boleto_linha_digitavel.message}</p>
                      )}
                      <p className="text-xs text-ds-text-muted">
                        A linha digitável será vinculada automaticamente após a autorização do cartão
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recorrência */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wallet className="h-5 w-5 text-primary" />
                    Recorrência
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Recorrência</Label>
                      <Controller
                        name="recurrence_type"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pontual">Pontual (única)</SelectItem>
                              <SelectItem value="diaria">Diária</SelectItem>
                              <SelectItem value="semanal">Semanal</SelectItem>
                              <SelectItem value="quinzenal">Quinzenal</SelectItem>
                              <SelectItem value="mensal">Mensal</SelectItem>
                              <SelectItem value="semestral">Semestral</SelectItem>
                              <SelectItem value="anual">Anual</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    {watchRecurrenceType !== "pontual" && (
                      <>
                        <div className="space-y-2">
                          <Label>Intervalo</Label>
                          <Controller
                            name="recurrence_interval"
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1,2,3,4,5,6].map((i) => (
                                    <SelectItem key={i} value={i.toString()}>
                                      A cada {i} {i === 1 ? 'período' : 'períodos'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="recurrence_end_date">Data Final (opcional)</Label>
                          <Input
                            id="recurrence_end_date"
                            type="date"
                            {...register("recurrence_end_date")}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Template de Mensagem */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Template de Mensagem</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Selecionar Template</Label>
                    <Controller
                      name="message_template_id"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || "none"} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={loadingTemplates ? "Carregando..." : "Selecione um template"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum template</SelectItem>
                            {messageTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {templatesError && (
                      <p className="text-xs text-destructive">Erro ao carregar templates</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calculator className="h-5 w-5 text-primary" />
                    Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-ds-text-muted">Pagador:</span>
                      <span className="font-medium text-ds-text-strong truncate max-w-[150px]">
                        {watchPayerName || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ds-text-muted">Valor:</span>
                      <span className="font-medium text-ds-text-strong">
                        {watchAmount ? formatCurrency(formatAmount(watchAmount)) : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ds-text-muted">Método:</span>
                      <span className="font-medium text-ds-text-strong">
                        {watchPaymentMethod === 'pix' ? 'PIX' : 'Cartão'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ds-text-muted">Tipo:</span>
                      <span className="font-medium text-ds-text-strong capitalize">
                        {watchRecurrenceType}
                      </span>
                    </div>
                    {(watchPaymentMethod === 'cartao' || watchPaymentMethod === 'cartao_pix') && watchBoletoLinhaDigitavel && (
                      <div className="flex justify-between text-sm">
                        <span className="text-ds-text-muted">Boleto:</span>
                        <span className="font-medium text-primary">Será vinculado</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-ds-border-subtle">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading || settingsLoading}
                    >
                      {isLoading ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Criando...
                        </>
                      ) : (
                        'Criar Cobrança'
                      )}
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowSimulatorModal(true)}
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Simular Pagamento
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>

        {/* Modals */}
        <SimulatorModal
          open={showSimulatorModal}
          onOpenChange={setShowSimulatorModal}
        />

        {showCheckoutModal && checkoutData && (
          <CheckoutSuccessModal
            open={showCheckoutModal}
            onOpenChange={(open) => {
              setShowCheckoutModal(open);
              if (!open) setCheckoutData(null);
            }}
            checkoutData={{
              chargeId: checkoutData.chargeId,
              checkoutUrl: checkoutData.checkoutUrl,
              amount: checkoutData.amount,
              payerName: checkoutData.payerName,
              description: checkoutData.description,
              status: checkoutData.status
            }}
          />
        )}
      </div>
    </DashboardShell>
  );
}
