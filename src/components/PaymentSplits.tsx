import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { CreditCard, QrCode, Receipt, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PaymentSplit {
  id?: string;
  method: 'PIX' | 'CARD' | 'QUITA';
  amount_cents: number;
  status: 'pending' | 'concluded' | 'failed';
  processed_at?: string;
}

interface PaymentSplitsProps {
  chargeId: string;
  totalAmount: number; // in cents
  hasBoletoLink: boolean;
  onPaymentComplete: () => void;
}

export function PaymentSplits({ chargeId, totalAmount, hasBoletoLink, onPaymentComplete }: PaymentSplitsProps) {
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [enableSplitPayment, setEnableSplitPayment] = useState(false);
  const [pixAmount, setPixAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingSplits, setSavingSplits] = useState(false);
  const { toast } = useToast();

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

  const loadSplits = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('payment-splits', {
        body: { 
          chargeId,
          path: `/charges/${chargeId}/splits`,
          method: 'GET'
        }
      });

      if (error) throw error;
      setSplits(data.splits || []);
    } catch (error: any) {
      console.error('Error loading splits:', error);
      toast({
        title: 'Erro ao carregar divisões',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSplits = async () => {
    try {
      setSavingSplits(true);
      
      let splitsToSave: PaymentSplit[] = [];

      if (hasBoletoLink) {
        // Force single QUITA split for boleto
        splitsToSave = [{ method: 'QUITA', amount_cents: totalAmount, status: 'pending' }];
      } else if (enableSplitPayment) {
        // Split between PIX and CARD
        const pixCents = parseCurrency(pixAmount);
        const cardCents = parseCurrency(cardAmount);
        
        if (pixCents + cardCents !== totalAmount) {
          toast({
            title: 'Soma incorreta',
            description: 'A soma dos valores deve ser igual ao total da cobrança',
            variant: 'destructive',
          });
          return;
        }

        if (pixCents > 0) splitsToSave.push({ method: 'PIX', amount_cents: pixCents, status: 'pending' });
        if (cardCents > 0) splitsToSave.push({ method: 'CARD', amount_cents: cardCents, status: 'pending' });
      } else {
        // Single payment method (default CARD)
        splitsToSave = [{ method: 'CARD', amount_cents: totalAmount, status: 'pending' }];
      }

      const { data, error } = await supabase.functions.invoke('payment-splits', {
        body: { 
          chargeId,
          path: `/charges/${chargeId}/splits`,
          method: 'POST',
          splits: splitsToSave
        }
      });

      if (error) throw error;
      
      setSplits(data.splits);
      toast({
        title: 'Divisões salvas',
        description: 'As divisões de pagamento foram salvas com sucesso',
      });
    } catch (error: any) {
      console.error('Error saving splits:', error);
      toast({
        title: 'Erro ao salvar divisões',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSplits(false);
    }
  };

  const updateSplitStatus = async (splitId: string, status: 'concluded' | 'failed') => {
    try {
      const { data, error } = await supabase.functions.invoke('payment-splits', {
        body: { 
          splitId,
          path: `/payment-splits/${splitId}/status`,
          method: 'PATCH',
          status
        }
      });

      if (error) throw error;

      // Reload splits to get updated status
      await loadSplits();
      
      toast({
        title: status === 'concluded' ? 'Split concluído' : 'Split falhado',
        description: `O split foi marcado como ${status === 'concluded' ? 'concluído' : 'falhado'}`,
      });

      // Check if all splits are concluded
      const updatedSplits = splits.map(split => 
        split.id === splitId ? { ...split, status } : split
      );
      
      if (updatedSplits.every(split => split.status === 'concluded')) {
        onPaymentComplete();
      }
    } catch (error: any) {
      console.error('Error updating split status:', error);
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: 'Pendente', variant: 'secondary' as const },
      concluded: { label: 'Concluído', variant: 'default' as const },
      failed: { label: 'Falhado', variant: 'destructive' as const },
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.pending;
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'PIX': return <QrCode className="w-4 h-4" />;
      case 'CARD': return <CreditCard className="w-4 h-4" />;
      case 'QUITA': return <Receipt className="w-4 h-4" />;
      default: return null;
    }
  };

  useEffect(() => {
    loadSplits();
  }, [chargeId]);

  useEffect(() => {
    if (!enableSplitPayment && !hasBoletoLink) {
      setCardAmount(formatCurrency(totalAmount));
      setPixAmount('');
    }
  }, [enableSplitPayment, totalAmount, hasBoletoLink]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2">Carregando divisões...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Divisão de Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasBoletoLink ? (
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="w-5 h-5 text-primary" />
              <span className="font-medium">Pagamento via Boleto (Simulado)</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Esta cobrança está vinculada a boleto (simulado). O pagamento será processado pela modalidade QUITA.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-2">
              <Switch 
                id="split-payment" 
                checked={enableSplitPayment}
                onCheckedChange={setEnableSplitPayment}
              />
              <Label htmlFor="split-payment">Dividir entre PIX e Cartão</Label>
            </div>

            {enableSplitPayment ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pix-amount">PIX</Label>
                    <Input
                      id="pix-amount"
                      value={pixAmount}
                      onChange={(e) => setPixAmount(e.target.value)}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="card-amount">Cartão</Label>
                    <Input
                      id="card-amount"
                      value={cardAmount}
                      onChange={(e) => setCardAmount(e.target.value)}
                      placeholder="R$ 0,00"
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: {formatCurrency(totalAmount)} | 
                  Soma atual: {formatCurrency(parseCurrency(pixAmount) + parseCurrency(cardAmount))}
                </div>
              </div>
            ) : (
              <div>
                <Label>Método único</Label>
                <Input value={formatCurrency(totalAmount)} disabled />
              </div>
            )}
          </>
        )}

        {splits.length === 0 ? (
          <Button onClick={saveSplits} disabled={savingSplits} className="w-full">
            {savingSplits && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar Divisões
          </Button>
        ) : (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium">Splits Atuais</h4>
              {splits.map((split, index) => (
                <div key={split.id || index} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    {getMethodIcon(split.method)}
                    <div>
                      <div className="font-medium">{split.method}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(split.amount_cents)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadge(split.status).variant}>
                      {getStatusBadge(split.status).label}
                    </Badge>
                    {split.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => updateSplitStatus(split.id!, 'concluded')}
                        >
                          Concluir
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateSplitStatus(split.id!, 'failed')}
                        >
                          Falhar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}