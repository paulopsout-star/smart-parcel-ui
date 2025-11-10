import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Receipt, Banknote, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { useSubscription } from "@/hooks/useSubscription";
import { useSubscriptionContext } from "@/contexts/SubscriptionContext";
import { CheckoutSuccessModal } from '@/components/CheckoutSuccessModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { FormSection } from '@/components/forms/FormSection';
import { FormField } from '@/components/forms/FormField';
import { SummaryCard } from '@/components/forms/SummaryCard';
import { FieldSkeleton } from '@/components/forms/FieldSkeleton';
import { formatPhone, formatDocument, unformatPhone, unformatDocument } from '@/lib/input-masks';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  // Dados do pagador
  payer_name: z.string().min(1, "Nome é obrigatório").max(200, "Nome deve ter no máximo 200 caracteres"),
  payer_email: z.string().email("Email inválido"),
  payer_phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos").max(11, "Telefone deve ter no máximo 11 dígitos"),
  payer_document: z.string().min(11, "Documento inválido"),
  
  // Dados da cobrança
  amount: z.string().min(1, "Valor é obrigatório"),
  description: z.string().optional(),
  installments: z.string(),
  mask_fee: z.boolean(),
  has_boleto: z.boolean(),
  boleto_barcode: z.string().optional(),
  message_template_id: z.string().optional(),
  
  // Novos campos para vínculo de boleto
  has_boleto_link: z.boolean().default(true),
  boleto_linha_digitavel: z.string().min(1, "Linha digitável é obrigatória").refine((val) => {
    const digitsOnly = val.replace(/\D/g, '');
    return digitsOnly.length === 47 || digitsOnly.length === 48;
  }, {
    message: "Linha digitável deve ter 47 ou 48 dígitos"
  }),
  
  // Recorrência
  recurrence_type: z.enum(["pontual", "diaria", "semanal", "quinzenal", "mensal", "semestral", "anual"]),
  recurrence_interval: z.string(),
  recurrence_end_date: z.string().optional(),
});

interface FormData {
  payer_name: string;
  payer_email: string;
  payer_phone: string;
  payer_document: string;
  amount: string;
  description?: string;
  installments: string;
  mask_fee: boolean;
  has_boleto: boolean;
  boleto_barcode?: string;
  message_template_id?: string;
  has_boleto_link: boolean;
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
  const [creditorSettings, setCreditorSettings] = useState<{
    creditor_document: string;
    creditor_name: string;
    merchant_id: string;
  } | null>(null);
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
  const { checkSubscriptionOrThrow, isAllowed, revalidateOnNewCharge } = useSubscription();
  const { readOnly, canonicalStatus } = useSubscriptionContext();
  
  // Hook to load message templates scoped by company_id
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
      mask_fee: false,
      has_boleto: false,
      has_boleto_link: true,
      installments: "1",
      recurrence_type: "pontual",
      recurrence_interval: "1"
    }
  });

  const watchRecurrenceType = watch("recurrence_type");
  const watchAmount = watch("amount");
  const watchHasBoleto = watch("has_boleto");
  const watchHasBoletoLink = watch("has_boleto_link");
  const watchBoletoLinhaDigitavel = watch("boleto_linha_digitavel");
  const watchPayerName = watch("payer_name");

  // Verificar conta PIX e revalidar assinatura
  useEffect(() => {
    const loadData = async () => {
      // Aguardar o AuthContext terminar de carregar
      if (authLoading) {
        setCheckingPayoutAccount(true);
        return;
      }
      
      if (!profile) {
        setCheckingPayoutAccount(false);
        return;
      }
      
      // Revalidate subscription when opening this page
      revalidateOnNewCharge();
      
      setCheckingPayoutAccount(true);

      try {
        // Buscar configurações do credor
        const { data: settingsData, error: settingsError } = await supabase.functions.invoke('company-settings');
        
        if (settingsError) {
          console.error('Error loading creditor settings:', settingsError);
        } else if (settingsData) {
          setCreditorSettings(settingsData);
          console.log('[NewCharge] Creditor settings loaded');
        }

        // Verificar conta PIX ativa
        const { data: payoutData, error: payoutError } = await supabase
          .from('payout_accounts')
          .select('id')
          .eq('user_id', profile.id)
          .eq('is_active', true)
          .limit(1);

        if (payoutError) throw payoutError;
        setHasPayoutAccount((payoutData ?? []).length > 0);

      } catch (error) {
        console.error('Error loading payout account:', error);
      } finally {
        setCheckingPayoutAccount(false);
      }
    };

    loadData();
  }, [profile, authLoading, revalidateOnNewCharge]);

  const formatAmount = (value: string) => {
    // Convert string to cents (integer)
    const numericValue = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.'));
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

  // Helper function to normalize linha digitável
  const normalizeBoletoLinhaDigitavel = (linha: string) => {
    return linha.replace(/\D/g, ''); // Remove all non-digits
  };

  const onSubmit = async (data: FormData) => {
    console.log('✅ Iniciando criação de cobrança:', {
      tipo: data.recurrence_type,
      valor: data.amount,
      pagador: data.payer_name
    });
    
    if (!profile) return;
    
    // Verificar assinatura antes de criar cobrança
    try {
      await checkSubscriptionOrThrow();
    } catch (error) {
      toast({
        title: 'Assinatura Inativa',
        description: error instanceof Error ? error.message : 'Sua assinatura não permite criar novas cobranças.',
        className: 'bg-feedback-error-bg border-feedback-error text-feedback-error'
      });
      return;
    }
    
    // Validar conta PIX apenas para cobranças recorrentes sem boleto
    // Para cobranças pontuais, o checkout de cartão não requer conta PIX
    if (data.recurrence_type !== 'pontual' && !data.has_boleto && !hasPayoutAccount) {
      setError('Para cobranças recorrentes sem boleto, é necessário ter uma conta PIX cadastrada.');
      toast({
        title: "Conta PIX necessária",
        description: "Cadastre uma conta PIX em 'Contas PIX' antes de criar cobranças recorrentes sem boleto.",
        className: 'bg-feedback-warning-bg border-feedback-warning text-feedback-warning'
      });
      return;
    }
    
    // Log UI event for telemetry
    if (data.recurrence_type === "pontual") {
      console.log('ui.newcharge.pontual.toggle_boleto_link:', data.has_boleto_link ? 'on' : 'off');
    }
    
    setIsLoading(true);
    setError("");

    try {
      const amountInCents = formatAmount(data.amount);
      const interval = parseInt(data.recurrence_interval) || 1;
      const nextChargeDate = calculateNextChargeDate(data.recurrence_type, interval);

      // Buscar snapshot do template de mensagem se selecionado
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

      // Normalize linha digitável if provided
      const normalizedLinhaDigitavel = data.boleto_linha_digitavel 
        ? normalizeBoletoLinhaDigitavel(data.boleto_linha_digitavel)
        : null;

      // Backend logging for telemetry
      if (data.has_boleto_link && normalizedLinhaDigitavel) {
        console.log('Backend: boleto_linha_digitavel saved', {
          length: normalizedLinhaDigitavel.length,
          hash_prefix: normalizedLinhaDigitavel.substring(0, 8) // Log first 8 digits only
        });
      }

      // Create charge record
      const { data: charge, error: chargeError } = await supabase
        .from('charges')
        .insert({
          created_by: profile.id,
          payer_name: data.payer_name,
          payer_email: data.payer_email,
          payer_document: unformatDocument(data.payer_document),
          payer_phone: unformatPhone(data.payer_phone),
          amount: amountInCents,
          description: data.description || null,
          installments: parseInt(data.installments),
          mask_fee: data.mask_fee,
          has_boleto: data.has_boleto,
          boleto_barcode: data.boleto_barcode || null,
          // New fields for boleto link
          has_boleto_link: data.recurrence_type === "pontual" ? data.has_boleto_link : false,
          boleto_linha_digitavel: data.recurrence_type === "pontual" && data.has_boleto_link ? normalizedLinhaDigitavel : null,
          // Creditor settings from company-settings edge function
          creditor_document: creditorSettings?.creditor_document || null,
          creditor_name: creditorSettings?.creditor_name || null,
          message_template_id: data.message_template_id === "none" ? null : data.message_template_id,
          message_template_snapshot: messageTemplateSnapshot,
          recurrence_type: data.recurrence_type,
          recurrence_interval: interval,
          recurrence_end_date: data.recurrence_end_date ? new Date(data.recurrence_end_date).toISOString() : null,
          next_charge_date: nextChargeDate?.toISOString() || null,
          metadata: {
            created_via: 'web_interface',
            user_agent: navigator.userAgent
          }
        })
        .select()
        .single();

      if (chargeError) {
        throw chargeError;
      }

      console.log('[NewCharge] Cobrança criada com sucesso no banco:', charge.id);

      // Se houver template de mensagem, enviar mensagem mock
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
          // Não falhar a criação da cobrança por causa da mensagem
        }
      }

      // Para cobranças recorrentes ou com boleto físico, apenas informar sucesso
      // O processamento via integração externa será implementado posteriormente
      if (data.recurrence_type !== 'pontual' || data.has_boleto) {
        toast({
          title: "Cobrança criada com sucesso!",
          description: data.recurrence_type === 'pontual' 
            ? "Cobrança com boleto criada. O processamento será realizado quando a integração estiver ativa."
            : `Cobrança recorrente configurada (${data.recurrence_type}). O agendamento será processado quando a integração estiver ativa.`,
          className: 'bg-feedback-success-bg border-feedback-success text-feedback-success'
        });
        navigate('/charges');
        return;
      }

      // Para cobranças pontuais de cartão, gerar link de checkout interno (sem API externa)
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
          
          console.log('[NewCharge] Link gerado com sucesso:', linkData.link.url);
          
          // Adicionar query param ?mode=split ou ?mode=direct baseado no toggle
          const checkoutMode = enableSplit ? 'split' : 'direct';
          const checkoutUrlWithMode = `${linkData.link.url}${linkData.link.url.includes('?') ? '&' : '?'}mode=${checkoutMode}`;
          
          // Construir checkoutData completo com os dados da cobrança criada
          const fullCheckoutData = {
            chargeId: charge.id,
            checkoutUrl: checkoutUrlWithMode,
            linkId: linkData.link.linkId || linkData.link.id, // Suporte para ambos formatos
            amount: charge.amount, // já está em centavos do banco
            payerName: charge.payer_name,
            description: charge.description || undefined,
            status: 'PENDENTE' as const
          };

          console.log('[NewCharge] Checkout data completo:', fullCheckoutData);

          // Toast de sucesso
          toast({
            title: "Link de pagamento gerado!",
            description: enableSplit 
              ? "Link com split PIX+Cartão criado com sucesso."
              : "Link de pagamento direto criado com sucesso.",
            className: 'bg-feedback-success-bg border-feedback-success text-feedback-success'
          });
          
          // Setar dados completos
          setCheckoutData(fullCheckoutData);
          setShowCheckoutModal(true);
          
          // Não navegar para /charges, ficar para mostrar o modal
          return;
        } catch (error) {
          console.error('[NewCharge] Erro ao gerar checkout:', error);
          toast({
            title: "Cobrança criada com aviso",
            description: "A cobrança foi criada, mas o link de pagamento não pôde ser gerado automaticamente. Use 'Gerar Link' no histórico.",
            className: 'bg-feedback-warning-bg border-feedback-warning text-feedback-warning'
          });
          
          // Navegar para o histórico mesmo com erro
          setTimeout(() => navigate('/charges'), 2000);
          return;
        }
      }

      navigate('/charges');

    } catch (error: any) {
      console.error('Error creating charge:', error);
      setError('Erro ao criar cobrança. Tente novamente.');
      toast({
        title: "Erro ao criar cobrança",
        description: error.message || 'Tente novamente.',
        className: 'bg-feedback-error-bg border-feedback-error text-feedback-error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calcular erros de validação para o SummaryCard
  const validationErrors = [
    !watchAmount && "Valor não informado",
    !watchBoletoLinhaDigitavel && "Linha digitável obrigatória",
    errors.payer_name?.message,
    errors.payer_email?.message,
    errors.payer_phone?.message,
    errors.payer_document?.message,
    errors.boleto_linha_digitavel?.message,
    errors.amount?.message
  ].filter(Boolean) as string[];

  const isFormValid = Object.keys(errors).length === 0 && !!watchAmount && !!watchBoletoLinhaDigitavel;

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-ink">Nova Cobrança</h1>
            <p className="text-sm text-ink-secondary">
              Crie uma cobrança pontual com vínculo de boleto
            </p>
          </div>
          
          <SubscriptionBanner />
          
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
            {/* Main Form - 2/3 */}
            <div className="xl:col-span-2 space-y-6">
              
                
                  {/* Dados do Pagador */}
                  <FormSection
                    title="Dados do Pagador"
                    icon={<User className="w-5 h-5 text-brand" />}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        label="Nome Completo"
                        htmlFor="payer_name"
                        error={errors.payer_name?.message}
                        required
                      >
                        <Input
                          id="payer_name"
                          placeholder="Nome do pagador"
                          {...register("payer_name")}
                          className={cn(
                            "transition-all duration-200",
                            errors.payer_name && "border-feedback-error focus:ring-feedback-error"
                          )}
                        />
                      </FormField>

                      <FormField
                        label="Email"
                        htmlFor="payer_email"
                        error={errors.payer_email?.message}
                        helpText="Será usado para envio de confirmações"
                        required
                      >
                        <Input
                          id="payer_email"
                          type="email"
                          placeholder="email@exemplo.com"
                          {...register("payer_email")}
                          className={cn(
                            "transition-all duration-200",
                            errors.payer_email && "border-feedback-error focus:ring-feedback-error"
                          )}
                        />
                      </FormField>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        label="Telefone"
                        htmlFor="payer_phone"
                        error={errors.payer_phone?.message}
                        helpText="Formato: (11) 99999-9999"
                        required
                      >
                        <Input
                          id="payer_phone"
                          placeholder="(11) 99999-9999"
                          {...register("payer_phone")}
                          onChange={(e) => {
                            const formatted = formatPhone(e.target.value);
                            setValue("payer_phone", formatted);
                          }}
                          className={cn(
                            "transition-all duration-200",
                            errors.payer_phone && "border-feedback-error focus:ring-feedback-error"
                          )}
                        />
                      </FormField>

                      <FormField
                        label="CPF/CNPJ"
                        htmlFor="payer_document"
                        error={errors.payer_document?.message}
                        helpText="Apenas números"
                        required
                      >
                        <Input
                          id="payer_document"
                          placeholder="000.000.000-00"
                          {...register("payer_document")}
                          onChange={(e) => {
                            const formatted = formatDocument(e.target.value);
                            setValue("payer_document", formatted);
                          }}
                          className={cn(
                            "transition-all duration-200",
                            errors.payer_document && "border-feedback-error focus:ring-feedback-error"
                          )}
                        />
                      </FormField>
                    </div>
                  </FormSection>

                  {/* Configurações da Cobrança */}
                  <FormSection
                    title="Configurações da Cobrança"
                    icon={<Receipt className="w-5 h-5 text-brand" />}
                  >
                    <div className="space-y-6">
                      {/* Valor */}
                      <FormField
                        label="Valor da Cobrança"
                        htmlFor="amount"
                        error={errors.amount?.message}
                        helpText="Valor total a ser cobrado"
                        required
                      >
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary font-medium">R$</span>
                          <Input
                            id="amount"
                            placeholder="0,00"
                            {...register("amount")}
                            className={cn(
                              "pl-10 font-medium text-lg transition-all duration-200",
                              errors.amount && "border-feedback-error focus:ring-feedback-error"
                            )}
                          />
                        </div>
                        {watchAmount && (
                          <p className="text-sm text-brand font-medium mt-2">
                            {formatCurrency(formatAmount(watchAmount))}
                          </p>
                        )}
                      </FormField>

                      {/* Linha Digitável */}
                      <FormField
                        label="Linha Digitável do Boleto"
                        htmlFor="boleto_linha_digitavel"
                        error={errors.boleto_linha_digitavel?.message}
                        helpText="47 ou 48 dígitos (apenas números)"
                        helpIcon
                        required
                      >
                        <Textarea
                          id="boleto_linha_digitavel"
                          placeholder="Digite ou cole a linha digitável do boleto"
                          {...register("boleto_linha_digitavel")}
                          className={cn(
                            "font-mono resize-none transition-all duration-200",
                            errors.boleto_linha_digitavel && "border-feedback-error focus:ring-feedback-error"
                          )}
                          rows={3}
                        />
                        
                        {/* Contador de dígitos */}
                        {watchBoletoLinhaDigitavel && (
                          <div className="flex items-center gap-2 mt-2">
                            <Banknote className="w-4 h-4 text-brand" />
                            <span className={cn(
                              "text-sm font-medium",
                              watchBoletoLinhaDigitavel.replace(/\D/g, '').length === 47 ||
                              watchBoletoLinhaDigitavel.replace(/\D/g, '').length === 48
                                ? "text-feedback-success"
                                : "text-ink-muted"
                            )}>
                              {watchBoletoLinhaDigitavel.replace(/\D/g, '').length} dígitos
                            </span>
                          </div>
                        )}
                      </FormField>

                      {/* Descrição */}
                      <FormField
                        label="Descrição"
                        htmlFor="description"
                        helpText="Informações adicionais sobre a cobrança"
                      >
                        <Textarea
                          id="description"
                          placeholder="Ex: Referente ao contrato #123..."
                          {...register("description")}
                          rows={4}
                          className="transition-all duration-200"
                        />
                      </FormField>

                      {/* Alerta de Conta PIX (se necessário) */}
                      {!hasPayoutAccount && !checkingPayoutAccount && (
                        <Alert className="bg-feedback-warning-bg border-feedback-warning">
                          <Wallet className="w-4 h-4 text-feedback-warning" />
                          <AlertDescription className="text-feedback-warning">
                            Você ainda não possui uma conta PIX cadastrada.{" "}
                            <Link to="/payout-accounts" className="underline font-medium">
                              Cadastrar agora
                            </Link>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </FormSection>
                
            </div>

            {/* Sidebar - 1/3 */}
            <div className="xl:col-span-1">
              <SummaryCard
                totalAmount={watchAmount ? formatAmount(watchAmount) : 0}
                recurrenceType={watchRecurrenceType}
                payerName={watchPayerName}
                isValid={isFormValid && !readOnly && isAllowed()}
                validationErrors={validationErrors}
                onSubmit={handleSubmit(onSubmit)}
                isLoading={isLoading}
              />
            </div>
          </form>

          {/* Checkout Success Modal */}
          {showCheckoutModal && checkoutData && (
            <CheckoutSuccessModal
              open={showCheckoutModal}
              onOpenChange={(open) => {
                setShowCheckoutModal(open);
                if (!open) {
                  setCheckoutData(null);
                  navigate('/charges');
                }
              }}
              checkoutData={checkoutData}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
