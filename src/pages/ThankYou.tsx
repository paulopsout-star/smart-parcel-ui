import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, ArrowLeft, History, Printer, RefreshCw, Calendar, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

// Hook para atualizar meta tags
const useDocumentTitle = (title: string) => {
  useEffect(() => {
    document.title = title;
    
    // Adicionar meta tags de SEO
    const metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (metaRobots) {
      metaRobots.content = 'noindex,nofollow';
    } else {
      const meta = document.createElement('meta');
      meta.name = 'robots';
      meta.content = 'noindex,nofollow';
      document.head.appendChild(meta);
    }
    
    // Definir idioma
    document.documentElement.lang = 'pt-BR';
  }, [title]);
};

interface ThankYouData {
  paid: boolean;
  processing?: boolean;
  message?: string;
  charge?: {
    id: string;
    type: string;
    total_amount_cents: number;
    currency: string;
    paid: boolean;
    paid_at: string;
    has_boleto_link: boolean;
  };
  splits?: Array<{
    id: string;
    method: string;
    amount_cents: number;
    status: string;
    processed_at?: string;
  }>;
  transactions?: Array<{
    id: string;
    created_at: string;
    amount_cents: number;
    method: string;
    transaction_id: string;
  }>;
  recurrence?: {
    next_dates: string[];
  };
  ui?: {
    return_url?: string;
    support_hint: string;
  };
}

// Telemetria local simples
const analyticsLocal = {
  track: (event: string, data: any) => {
    console.log(`Analytics: ${event}`, data);
    // Em produção, poderia enviar para um endpoint analytics local
  }
};

export default function ThankYou() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [data, setData] = useState<ThankYouData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const token = searchParams.get('pl');

  // Configurar meta tags da página
  useDocumentTitle('Pagamento Confirmado - Sistema de Cobrança');

  const loadData = async () => {
    if (!token) {
      setError('Token de pagamento não encontrado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Construir URL com parâmetro correto  
      const functionUrl = `https://gsbbrkbeyxsqqjqhptrn.supabase.co/functions/v1/thank-you-summary?pl=${token}`;
      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYmJya2JleXhzcXFqcWhwdHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODk5NTQsImV4cCI6MjA3Mzg2NTk1NH0.I5l0SDwsAN_rsSdoZiE9GAndkn3tkqX44O5ypu0cu7w`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setData(data);
      
      // Telemetria: registrar visualização
      if (data.paid && data.charge) {
        analyticsLocal.track('thank_you.view', {
          charge_id: data.charge.id,
          total: data.charge.total_amount_cents,
          methods: data.splits?.map((s: any) => s.method) || []
        });
      }
    } catch (err) {
      console.error('Error loading thank you data:', err);
      setError('Erro ao carregar dados do pagamento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Cleanup timers on unmount
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, [token]);

  // Retry automático para estado de processamento
  useEffect(() => {
    if (data?.processing && !data?.paid && retryCount < 3) {
      console.log(`[ThankYou] Auto-retry ${retryCount + 1}/3 in 3s...`);
      
      retryTimerRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        loadData();
      }, 3000);
    }
    
    // Timeout de 30s
    if (data?.processing && !data?.paid && retryCount === 0) {
      timeoutTimerRef.current = setTimeout(() => {
        console.log('[ThankYou] Timeout reached (30s)');
        setError('O pagamento está demorando mais do que o esperado. Por favor, entre em contato com o suporte.');
      }, 30000);
    }
    
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [data, retryCount]);

  const formatCurrency = (amountCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amountCents / 100);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getMethodBadgeVariant = (method: string) => {
    switch (method.toUpperCase()) {
      case 'PIX': return 'default';
      case 'CARD': return 'secondary';
      case 'QUITA': return 'outline';
      default: return 'outline';
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method.toUpperCase()) {
      case 'PIX': return 'PIX';
      case 'CARD': return 'Cartão';
      case 'QUITA': return 'Quita+';
      default: return method;
    }
  };

  const handlePrint = () => {
    analyticsLocal.track('thank_you.print', {
      charge_id: data?.charge?.id,
      total: data?.charge?.total_amount_cents
    });
    window.print();
  };

  const handleDownloadPDF = async () => {
    setIsDownloadingPDF(true);
    
    try {
      analyticsLocal.track('thank_you.download_pdf', {
        charge_id: data?.charge?.id,
        total: data?.charge?.total_amount_cents
      });

      // Importar html2pdf dinamicamente
      const html2pdf = (await import('html2pdf.js')).default;
      
      const element = document.getElementById('comprovante-container');
      if (!element) {
        throw new Error('Elemento do comprovante não encontrado');
      }

      const opt = {
        margin: 10,
        filename: `comprovante-${data?.charge?.id.slice(0, 8)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      await html2pdf().set(opt).from(element).save();
      
      toast({
        title: "PDF gerado!",
        description: "O comprovante foi baixado com sucesso.",
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o PDF. Tente usar a opção de imprimir.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Carregando dados do pagamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.href = '/'}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.paid && data?.processing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Pagamento em processamento</h2>
            <p className="text-muted-foreground mb-4">
              Estamos confirmando seu pagamento. Isso pode levar alguns segundos.
            </p>
            <Button onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div id="comprovante-container" className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8 print:mb-4">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4 print:h-8 print:w-8" />
          <h1 className="text-3xl font-bold text-green-600 mb-2 print:text-xl">
            Pagamento Confirmado! 🎉
          </h1>
          <p className="text-muted-foreground print:text-xs">
            Obrigado! Seu pagamento foi processado com sucesso.
          </p>
        </div>

        {/* Resumo Principal */}
        <Card className="mb-6 print:shadow-none print:border-gray-300">
          <CardHeader className="print:pb-2">
            <CardTitle className="print:text-lg">Resumo da Transação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 print:space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium print:text-sm">Valor Total:</span>
              <span className="text-2xl font-bold text-green-600 print:text-lg">
                {formatCurrency(data?.charge?.total_amount_cents || 0)}
              </span>
            </div>

            <div className="flex justify-between items-center print:text-sm">
              <span>Data/Hora:</span>
              <span>{data?.charge?.paid_at ? formatDate(data.charge.paid_at) : '-'}</span>
            </div>

            <div className="flex justify-between items-center print:text-sm">
              <span>ID da Cobrança:</span>
              <span className="font-mono text-xs">
                {data?.charge?.id.slice(0, 8)}...
              </span>
            </div>

            <div className="flex justify-between items-start print:text-sm">
              <span>Meios Utilizados:</span>
              <div className="flex flex-wrap gap-1">
                {data?.splits?.map((split) => (
                  <Badge 
                    key={split.id} 
                    variant={getMethodBadgeVariant(split.method)}
                    className="print:text-xs print:px-1 print:py-0"
                  >
                    {getMethodLabel(split.method)}
                  </Badge>
                ))}
              </div>
            </div>

            {data?.charge?.has_boleto_link && (
              <div className="bg-muted p-3 rounded-lg print:p-2 print:text-xs">
                <p className="text-sm text-muted-foreground">
                  ℹ️ Pagamento vinculado a boleto (simulado)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalhes dos Splits */}
        {data?.splits && data.splits.length > 0 && (
          <Card className="mb-6 print:shadow-none print:border-gray-300">
            <CardHeader className="print:pb-2">
              <CardTitle className="print:text-lg">Detalhamento do Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 print:space-y-1">
                {data.splits.map((split, index) => (
                  <div key={split.id}>
                    <div className="flex justify-between items-center print:text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={getMethodBadgeVariant(split.method)} className="print:text-xs">
                          {getMethodLabel(split.method)}
                        </Badge>
                        <span className="text-sm text-muted-foreground print:text-xs">
                          {split.processed_at ? formatDate(split.processed_at) : '-'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(split.amount_cents)}
                        </div>
                        <Badge variant="outline" className="text-xs print:text-xs">
                          {split.status}
                        </Badge>
                      </div>
                    </div>
                    {index < data.splits.length - 1 && (
                      <Separator className="mt-3 print:mt-1" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Próximas Cobranças (Recorrente) */}
        {data?.recurrence?.next_dates && data.recurrence.next_dates.length > 0 && (
          <Card className="mb-6 print:break-inside-avoid print:shadow-none print:border-gray-300">
            <CardHeader className="print:pb-2">
              <CardTitle className="flex items-center gap-2 print:text-lg">
                <Calendar className="h-5 w-5 print:h-4 print:w-4" />
                Próximas Cobranças
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 print:space-y-1">
                {data.recurrence.next_dates.slice(0, 3).map((date, index) => (
                  <div key={index} className="flex justify-between items-center print:text-sm">
                    <span>#{index + 1}</span>
                    <span className="font-medium">
                      {formatDate(date)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center print:hidden">
          {data?.ui?.return_url ? (
            <Button onClick={() => window.open(data.ui!.return_url, '_self')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao site
            </Button>
          ) : (
            <Button asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao início
              </Link>
            </Button>
          )}

          <Button variant="outline" asChild>
            <Link to="/charges">
              <History className="h-4 w-4 mr-2" />
              Ver histórico
            </Link>
          </Button>

          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>

          <Button variant="outline" onClick={handleDownloadPDF} disabled={isDownloadingPDF}>
            {isDownloadingPDF ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Baixar PDF
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground print:mt-4 print:text-xs">
          <p>{data?.ui?.support_hint}</p>
          <p className="mt-2">
            Guarde este comprovante para seus registros.
          </p>
        </div>
      </div>

      {/* CSS de Impressão */}
      <style>{`
        @media print {
          @page {
            margin: 1cm;
            size: A4;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:text-xs {
            font-size: 0.75rem !important;
          }
          
          .print\\:text-sm {
            font-size: 0.875rem !important;
          }
          
          .print\\:text-lg {
            font-size: 1.125rem !important;
          }
          
          .print\\:text-xl {
            font-size: 1.25rem !important;
          }
          
          .print\\:h-4 {
            height: 1rem !important;
          }
          
          .print\\:w-4 {
            width: 1rem !important;
          }
          
          .print\\:h-8 {
            height: 2rem !important;
          }
          
          .print\\:w-8 {
            width: 2rem !important;
          }
          
          .print\\:mb-4 {
            margin-bottom: 1rem !important;
          }
          
          .print\\:mt-4 {
            margin-top: 1rem !important;
          }
          
          .print\\:pb-2 {
            padding-bottom: 0.5rem !important;
          }
          
          .print\\:p-2 {
            padding: 0.5rem !important;
          }
          
          .print\\:px-1 {
            padding-left: 0.25rem !important;
            padding-right: 0.25rem !important;
          }
          
          .print\\:py-0 {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
          
          .print\\:space-y-1 > * + * {
            margin-top: 0.25rem !important;
          }
          
          .print\\:space-y-2 > * + * {
            margin-top: 0.5rem !important;
          }
          
          .print\\:mt-1 {
            margin-top: 0.25rem !important;
          }
          
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          
          .print\\:border-gray-300 {
            border-color: #d1d5db !important;
          }
          
          .print\\:break-inside-avoid {
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}