import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, CreditCard, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

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
  recurrence_type: "pontual" | "diaria" | "semanal" | "quinzenal" | "mensal" | "semestral" | "anual";
  recurrence_interval: string;
  recurrence_end_date?: string;
}

export default function NewCharge() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [messageTemplates, setMessageTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [hasPayoutAccount, setHasPayoutAccount] = useState(false);
  const [checkingPayoutAccount, setCheckingPayoutAccount] = useState(true);
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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

  // Carregar templates de mensagem e verificar conta PIX
  useEffect(() => {
    const loadData = async () => {
      if (!profile) return;
      
      setLoadingTemplates(true);
      setCheckingPayoutAccount(true);

      try {
        // Carregar templates
        const { data: templatesData, error: templatesError } = await supabase
          .from('message_templates')
          .select('*')
          .eq('user_id', profile.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (templatesError) throw templatesError;
        setMessageTemplates(templatesData || []);

        // Verificar conta PIX ativa
        const { data: payoutData, error: payoutError } = await supabase
          .from('payout_accounts')
          .select('id')
          .eq('user_id', profile.id)
          .eq('is_active', true)
          .limit(1);

        if (payoutError) throw payoutError;
        setHasPayoutAccount((payoutData || []).length > 0);

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoadingTemplates(false);
        setCheckingPayoutAccount(false);
      }
    };

    loadData();
  }, [profile]);

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

  const onSubmit = async (data: FormData) => {
    if (!profile) return;
    
    // Validar conta PIX para cobranças sem boleto
    if (!data.has_boleto && !hasPayoutAccount) {
      setError('Para cobranças sem boleto, é necessário ter uma conta PIX cadastrada.');
      toast({
        title: "Conta PIX necessária",
        description: "Cadastre uma conta PIX em 'Contas PIX' antes de criar cobranças sem boleto.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    setError("");

    try {
      const amountInCents = formatAmount(data.amount);
      const interval = parseInt(data.recurrence_interval) || 1;
      const nextChargeDate = calculateNextChargeDate(data.recurrence_type, interval);

      // Buscar snapshot do template de mensagem se selecionado
      let messageTemplateSnapshot = null;
      if (data.message_template_id) {
        const { data: template } = await supabase
          .from('message_templates')
          .select('*')
          .eq('id', data.message_template_id)
          .single();
        
        if (template) {
          messageTemplateSnapshot = {
            id: template.id,
            name: template.name,
            content: template.content,
            variables: template.variables
          };
        }
      }

      // Create charge record
      const { data: charge, error: chargeError } = await supabase
        .from('charges')
        .insert({
          created_by: profile.id,
          payer_name: data.payer_name,
          payer_email: data.payer_email,
          payer_document: data.payer_document.replace(/\D/g, ''),
          payer_phone: data.payer_phone.replace(/\D/g, ''),
          amount: amountInCents,
          description: data.description || null,
          installments: parseInt(data.installments),
          mask_fee: data.mask_fee,
          has_boleto: data.has_boleto,
          boleto_barcode: data.boleto_barcode || null,
          message_template_id: data.message_template_id || null,
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

      // Process charge immediately (create payment link and send message)
      const { data: executionResult, error: executionError } = await supabase.functions.invoke('process-charge', {
        body: {
          chargeId: charge.id,
          immediate: true
        }
      });

      // Se houver template de mensagem, enviar mensagem mock
      if (data.message_template_id && messageTemplateSnapshot) {
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

      if (executionError) {
        console.error('Error processing charge:', executionError);
        // Don't throw - the charge was created successfully
        toast({
          title: "Cobrança criada!",
          description: "A cobrança foi criada, mas houve um problema ao gerar o link. Tente novamente em alguns minutos.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Cobrança criada com sucesso!",
          description: data.recurrence_type === 'pontual' 
            ? "Link de pagamento gerado com sucesso."
            : `Cobrança recorrente configurada (${data.recurrence_type}).`,
        });
      }

      navigate('/charges');

    } catch (error: any) {
      console.error('Error creating charge:', error);
      setError('Erro ao criar cobrança. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Nova Cobrança</h1>
        <p className="text-muted-foreground">
          Crie uma cobrança pontual ou recorrente
        </p>
      </div>
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Main Form */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Dados do Pagador */}
                <Card>
                  <CardHeader>
                    <CardTitle>Dados do Pagador</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="payer_name">Nome Completo *</Label>
                        <Input
                          id="payer_name"
                          placeholder="Nome do pagador"
                          {...register("payer_name")}
                          className={errors.payer_name ? "border-destructive" : ""}
                        />
                        {errors.payer_name && (
                          <p className="text-sm text-destructive mt-1">{errors.payer_name.message}</p>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="payer_email">Email *</Label>
                        <Input
                          id="payer_email"
                          type="email"
                          placeholder="email@exemplo.com"
                          {...register("payer_email")}
                          className={errors.payer_email ? "border-destructive" : ""}
                        />
                        {errors.payer_email && (
                          <p className="text-sm text-destructive mt-1">{errors.payer_email.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="payer_phone">Telefone *</Label>
                        <Input
                          id="payer_phone"
                          placeholder="11999999999"
                          {...register("payer_phone")}
                          className={errors.payer_phone ? "border-destructive" : ""}
                        />
                        {errors.payer_phone && (
                          <p className="text-sm text-destructive mt-1">{errors.payer_phone.message}</p>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="payer_document">CPF/CNPJ *</Label>
                        <Input
                          id="payer_document"
                          placeholder="000.000.000-00"
                          {...register("payer_document")}
                          className={errors.payer_document ? "border-destructive" : ""}
                        />
                        {errors.payer_document && (
                          <p className="text-sm text-destructive mt-1">{errors.payer_document.message}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Dados da Cobrança */}
                <Card>
                  <CardHeader>
                    <CardTitle>Configurações da Cobrança</CardTitle>
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
                        <Label htmlFor="installments">Parcelas</Label>
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
                    </div>

                    <div className="flex items-center space-x-2">
                      <Controller
                        control={control}
                        name="mask_fee"
                        render={({ field }) => (
                          <Checkbox
                            id="mask_fee"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <Label htmlFor="mask_fee">
                        Parcelas fechadas (cliente não pode alterar)
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Controller
                        control={control}
                        name="has_boleto"
                        render={({ field }) => (
                          <Checkbox
                            id="has_boleto"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <Label htmlFor="has_boleto">
                        Cobrança com vínculo de boleto (simulado)
                      </Label>
                    </div>

                    {watchHasBoleto && (
                      <div>
                        <Label htmlFor="boleto_barcode">Linha Digitável do Boleto</Label>
                        <Input
                          id="boleto_barcode"
                          placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                          {...register("boleto_barcode")}
                          className="font-mono"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Digite a linha digitável do boleto para simulação
                        </p>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="message_template_id">Template de Mensagem</Label>
                      <Controller
                        control={control}
                        name="message_template_id"
                        render={({ field }) => (
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={loadingTemplates}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={loadingTemplates ? "Carregando..." : "Selecione um template"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Nenhum template</SelectItem>
                              {messageTemplates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Template para mensagem WhatsApp (simulado). {' '}
                        <Link to="/message-templates" className="text-primary hover:underline">
                          Gerenciar templates
                        </Link>
                      </p>
                    </div>

                    {!watchHasBoleto && !hasPayoutAccount && !checkingPayoutAccount && (
                      <Alert variant="destructive">
                        <Wallet className="w-4 h-4" />
                        <AlertDescription>
                          Para cobranças sem boleto, você precisa ter uma conta PIX cadastrada. 
                          <Link to="/payout-accounts" className="ml-1 underline">
                            Cadastrar conta PIX
                          </Link>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div>
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        placeholder="Descrição da cobrança..."
                        {...register("description")}
                        className={errors.description ? "border-destructive" : ""}
                      />
                      {errors.description && (
                        <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Recorrência */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recorrência</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Tipo de Cobrança</Label>
                      <Controller
                        control={control}
                        name="recurrence_type"
                        render={({ field }) => (
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pontual">Pontual (única vez)</SelectItem>
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

                    {watchRecurrenceType !== 'pontual' && (
                      <>
                        <div>
                          <Label htmlFor="recurrence_interval">Intervalo</Label>
                          <Input
                            id="recurrence_interval"
                            type="number"
                            min="1"
                            placeholder="1"
                            {...register("recurrence_interval")}
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            A cada {watch("recurrence_interval") || 1} {watchRecurrenceType === 'diaria' ? 'dia(s)' : 
                            watchRecurrenceType === 'semanal' ? 'semana(s)' :
                            watchRecurrenceType === 'quinzenal' ? 'quinzena(s)' :
                            watchRecurrenceType === 'mensal' ? 'mês(es)' :
                            watchRecurrenceType === 'semestral' ? 'semestre(s)' : 'ano(s)'}
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="recurrence_end_date">Data de Fim (opcional)</Label>
                          <Input
                            id="recurrence_end_date"
                            type="date"
                            {...register("recurrence_end_date")}
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            Deixe em branco para recorrência sem fim
                          </p>
                        </div>
                      </>
                    )}
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
                        {watch("installments")}x
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tipo:</span>
                      <span className="font-medium capitalize">
                        {watchRecurrenceType}
                      </span>
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Criar Cobrança
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
          </div>
        </form>
      </div>
    </div>
  );
}