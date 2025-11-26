import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Edit, Trash2, Wallet, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Layout } from "@/components/Layout";

const accountSchema = z.object({
  pix_key: z.string().min(1, "Chave PIX é obrigatória"),
  pix_key_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]),
  account_holder_name: z.string().min(1, "Nome do titular é obrigatório"),
  account_holder_document: z.string().min(11, "CPF/CNPJ é obrigatório"),
});

interface AccountData {
  pix_key: string;
  pix_key_type: "cpf" | "cnpj" | "email" | "phone" | "random";
  account_holder_name: string;
  account_holder_document: string;
}

interface PayoutAccount {
  id: string;
  pix_key: string;
  pix_key_type: string;
  account_holder_name: string;
  account_holder_document: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function PayoutAccounts() {
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PayoutAccount | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors }
  } = useForm<AccountData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      pix_key: "",
      pix_key_type: "cpf",
      account_holder_name: "",
      account_holder_document: ""
    }
  });

  const watchPixKeyType = watch("pix_key_type");

  const getPixKeyPlaceholder = (type: string) => {
    switch (type) {
      case "cpf": return "000.000.000-00";
      case "cnpj": return "00.000.000/0001-00";
      case "email": return "usuario@exemplo.com";
      case "phone": return "11999999999";
      case "random": return "c6e78ad6-1234-4321-abcd-1234567890ab";
      default: return "";
    }
  };

  const getPixKeyTypeLabel = (type: string) => {
    switch (type) {
      case "cpf": return "CPF";
      case "cnpj": return "CNPJ";
      case "email": return "E-mail";
      case "phone": return "Telefone";
      case "random": return "Chave Aleatória";
      default: return type;
    }
  };

  const loadAccounts = async () => {
    if (!profile) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payout_accounts')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading payout accounts:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar contas de recebimento.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [profile]);

  const onSubmit = async (data: AccountData) => {
    if (!profile) return;
    
    setIsSubmitting(true);
    try {
      const accountData = {
        user_id: profile.id,
        company_id: profile.company_id,
        pix_key: data.pix_key,
        pix_key_type: data.pix_key_type,
        account_holder_name: data.account_holder_name,
        account_holder_document: data.account_holder_document.replace(/\D/g, ''),
        is_active: true
      };

      if (editingAccount) {
        // Update existing account
        const { error } = await supabase
          .from('payout_accounts')
          .update(accountData)
          .eq('id', editingAccount.id);

        if (error) throw error;
        
        toast({
          title: "Conta atualizada!",
          description: "Conta de recebimento atualizada com sucesso."
        });
      } else {
        // Create new account
        const { error } = await supabase
          .from('payout_accounts')
          .insert(accountData);

        if (error) throw error;
        
        toast({
          title: "Conta criada!",
          description: "Conta de recebimento criada com sucesso."
        });
      }

      reset();
      setIsDialogOpen(false);
      setEditingAccount(null);
      loadAccounts();
    } catch (error: any) {
      console.error('Error saving payout account:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar conta de recebimento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (account: PayoutAccount) => {
    setEditingAccount(account);
    reset({
      pix_key: account.pix_key,
      pix_key_type: account.pix_key_type as any,
      account_holder_name: account.account_holder_name,
      account_holder_document: account.account_holder_document
    });
    setIsDialogOpen(true);
  };

  const handleToggleActive = async (accountId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('payout_accounts')
        .update({ is_active: !isActive })
        .eq('id', accountId);

      if (error) throw error;
      
      toast({
        title: isActive ? "Conta desativada!" : "Conta ativada!",
        description: `Conta ${isActive ? 'desativada' : 'ativada'} com sucesso.`
      });
      
      loadAccounts();
    } catch (error) {
      console.error('Error toggling account status:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status da conta.",
        variant: "destructive"
      });
    }
  };

  const handleSetAsDefault = async (accountId: string) => {
    if (!profile) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ default_payout_account_id: accountId })
        .eq('id', profile.id);

      if (error) throw error;
      
      toast({
        title: "Conta padrão definida!",
        description: "Conta definida como padrão para recebimentos."
      });
      
    } catch (error) {
      console.error('Error setting default account:', error);
      toast({
        title: "Erro",
        description: "Erro ao definir conta como padrão.",
        variant: "destructive"
      });
    }
  };

  const handleNewAccount = () => {
    setEditingAccount(null);
    reset({
      pix_key: "",
      pix_key_type: "cpf",
      account_holder_name: "",
      account_holder_document: ""
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Contas de Recebimento PIX</h1>
          <p className="text-muted-foreground">
            Gerencie suas contas PIX para recebimento de pagamentos
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewAccount}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Conta PIX
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Editar Conta PIX" : "Nova Conta PIX"}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="pix_key_type">Tipo de Chave PIX *</Label>
                <Controller
                  control={control}
                  name="pix_key_type"
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="phone">Telefone</SelectItem>
                        <SelectItem value="random">Chave Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              
              <div>
                <Label htmlFor="pix_key">Chave PIX *</Label>
                <Input
                  id="pix_key"
                  placeholder={getPixKeyPlaceholder(watchPixKeyType)}
                  {...register("pix_key")}
                  className={errors.pix_key ? "border-destructive" : ""}
                />
                {errors.pix_key && (
                  <p className="text-sm text-destructive mt-1">{errors.pix_key.message}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="account_holder_name">Nome do Titular *</Label>
                <Input
                  id="account_holder_name"
                  placeholder="Nome completo do titular"
                  {...register("account_holder_name")}
                  className={errors.account_holder_name ? "border-destructive" : ""}
                />
                {errors.account_holder_name && (
                  <p className="text-sm text-destructive mt-1">{errors.account_holder_name.message}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="account_holder_document">CPF/CNPJ do Titular *</Label>
                <Input
                  id="account_holder_document"
                  placeholder="000.000.000-00"
                  {...register("account_holder_document")}
                  className={errors.account_holder_document ? "border-destructive" : ""}
                />
                {errors.account_holder_document && (
                  <p className="text-sm text-destructive mt-1">{errors.account_holder_document.message}</p>
                )}
              </div>

              <Alert>
                <Wallet className="w-4 h-4" />
                <AlertDescription>
                  Esta conta será usada para receber pagamentos PIX. Certifique-se de que os dados estão corretos.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4 mr-2" />
                      {editingAccount ? "Atualizar" : "Criar"} Conta
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Contas PIX ({accounts.filter(a => a.is_active).length})</CardTitle>
          </CardHeader>
          <CardContent>
            {accounts.filter(a => a.is_active).length === 0 ? (
              <div className="text-center py-8">
                <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma conta PIX encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  Adicione uma conta PIX para receber pagamentos
                </p>
                <Button onClick={handleNewAccount}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Conta PIX
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Chave PIX</TableHead>
                    <TableHead>Titular</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.filter(a => a.is_active).map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {getPixKeyTypeLabel(account.pix_key_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {account.pix_key}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{account.account_holder_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {account.account_holder_document}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? "default" : "secondary"}>
                          {account.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetAsDefault(account.id)}
                            title="Definir como padrão"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(account)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(account.id, account.is_active)}
                            className={account.is_active ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}
                          >
                            {account.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}