import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, QrCode } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function CheckoutPix() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-background via-surface-light/20 to-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <QrCode className="h-8 w-8 text-muted-foreground" />
              <h1 className="text-3xl font-bold">Pagamento via PIX</h1>
            </div>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
              <Clock className="w-3 h-3 mr-1" />
              Em Manutenção
            </Badge>
          </div>

          {/* Mensagem de indisponibilidade */}
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="bg-amber-100/50">
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="h-5 w-5" />
                PIX Temporariamente Indisponível
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <p className="text-amber-900">
                  Estamos atualizando nosso sistema de pagamentos PIX para oferecer 
                  uma experiência ainda melhor.
                </p>
                <p className="text-amber-800 text-sm">
                  Por favor, utilize o <strong>pagamento via Cartão de Crédito</strong> ou 
                  tente novamente em breve.
                </p>
                <div className="pt-4">
                  <p className="text-xs text-amber-700">
                    Previsão de retorno: Em breve
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}
