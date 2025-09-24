import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Copy, ExternalLink, Share2, QrCode, MessageSquare, Mail, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ModalCheckoutLinkProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkoutData: {
    chargeId: string;
    checkoutUrl: string;
    linkId?: string;
    amount: number;
    payerName: string;
    description?: string;
    status?: 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO';
  };
  className?: string;
}

export function ModalCheckoutLink({ 
  open, 
  onOpenChange, 
  checkoutData, 
  className 
}: ModalCheckoutLinkProps) {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'PENDENTE': { label: 'Pendente', variant: 'secondary' as const },
      'PROCESSANDO': { label: 'Processando', variant: 'default' as const },
      'CONCLUIDO': { label: 'Concluído', variant: 'default' as const },
      'ERRO': { label: 'Erro', variant: 'destructive' as const },
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.PENDENTE;
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      
      toast({
        title: "Copiado!",
        description: "Link copiado para a área de transferência."
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const openCheckoutLink = () => {
    // Validate URL before opening
    if (!checkoutData.checkoutUrl || (!checkoutData.checkoutUrl.startsWith('http://') && !checkoutData.checkoutUrl.startsWith('https://'))) {
      toast({
        title: "Link inválido",
        description: "URL de checkout inválida.",
        variant: "destructive",
      });
      return;
    }
    window.open(checkoutData.checkoutUrl, '_blank', 'noopener,noreferrer');
  };

  const shareViaWhatsApp = () => {
    setIsSharing(true);
    
    const message = encodeURIComponent(
      `Olá ${checkoutData.payerName}! 👋\n\n` +
      `Seu link de pagamento está pronto:\n` +
      `💰 Valor: ${formatCurrency(checkoutData.amount)}\n` +
      `📋 ${checkoutData.description || 'Cobrança'}\n\n` +
      `🔗 Link: ${checkoutData.checkoutUrl}\n\n` +
      `Pague de forma segura e rápida! 🚀`
    );
    
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    
    setTimeout(() => setIsSharing(false), 1000);
  };

  const shareViaEmail = () => {
    setIsSharing(true);
    
    const subject = encodeURIComponent('Link de Pagamento - Autonegocie');
    const body = encodeURIComponent(
      `Olá ${checkoutData.payerName}!\n\n` +
      `Seu link de pagamento está disponível:\n\n` +
      `Valor: ${formatCurrency(checkoutData.amount)}\n` +
      `Descrição: ${checkoutData.description || 'Cobrança'}\n\n` +
      `Link de Pagamento: ${checkoutData.checkoutUrl}\n\n` +
      `Para pagar, clique no link acima e siga as instruções.\n\n` +
      `Atenciosamente,\n` +
      `Equipe Autonegocie`
    );
    
    const emailUrl = `mailto:?subject=${subject}&body=${body}`;
    window.open(emailUrl);
    
    setTimeout(() => setIsSharing(false), 1000);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn("max-w-2xl focus:outline-none", className)}
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-xl">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              Link de Checkout Disponível
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Charge Summary */}
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Status:</span>
                  <Badge variant={getStatusBadge(checkoutData.status || 'PENDENTE').variant}>
                    {getStatusBadge(checkoutData.status || 'PENDENTE').label}
                  </Badge>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Pagador:</span>
                    <span className="text-sm font-medium">{checkoutData.payerName}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Valor:</span>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(checkoutData.amount)}
                    </span>
                  </div>
                  
                  {checkoutData.description && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Descrição:</span>
                      <span className="text-sm font-medium text-right max-w-[200px] truncate">
                        {checkoutData.description}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">ID da Cobrança:</span>
                    <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      {checkoutData.chargeId.slice(-8)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Checkout Link */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              <span className="font-semibold">Link de Checkout:</span>
            </div>
            
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">URL do Pagamento:</p>
                  <p className="text-sm font-mono bg-background px-3 py-2 rounded border break-all">
                    {checkoutData.checkoutUrl}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(checkoutData.checkoutUrl, 'checkout-url')}
                  className="flex-1 min-w-[120px]"
                >
                  {copiedStates['checkout-url'] ? (
                    <Check className="w-4 h-4 mr-2" />
                  ) : (
                    <Copy className="w-4 h-4 mr-2" />
                  )}
                  {copiedStates['checkout-url'] ? 'Copiado!' : 'Copiar Link'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openCheckoutLink}
                  className="flex-1 min-w-[120px]"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir em Nova Aba
                </Button>
              </div>
            </div>
          </div>

          {/* Share Options */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              <span className="font-semibold">Compartilhar:</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={shareViaWhatsApp}
                disabled={isSharing}
                className="w-full"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              
              <Button
                variant="outline"
                onClick={shareViaEmail}
                disabled={isSharing}
                className="w-full"
              >
                <Mail className="w-4 h-4 mr-2" />
                E-mail
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Use os botões acima para copiar ou compartilhar o link.
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose}>
                Fechar
              </Button>
              <Button onClick={() => window.location.href = '/charges'} className="min-w-[120px]">
                Ver Histórico
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Default export for compatibility
export default ModalCheckoutLink;