import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, QrCode } from 'lucide-react';

export default function PaymentPix() {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-6 lg:p-8 rounded-2xl shadow-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 mb-4">
            <QrCode className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Pagamento via PIX</h1>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
            <Clock className="w-3 h-3 mr-1" />
            Em Manutenção
          </Badge>
        </div>

        {/* Mensagem de indisponibilidade */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-4">
          <div className="flex justify-center">
            <AlertCircle className="h-12 w-12 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-amber-800 mb-2">
              PIX Temporariamente Indisponível
            </h2>
            <p className="text-amber-700">
              Estamos atualizando nosso sistema de pagamentos PIX para oferecer 
              uma experiência ainda melhor.
            </p>
          </div>
          <div className="pt-2">
            <p className="text-sm text-amber-600">
              Por favor, utilize o <strong>pagamento via Cartão de Crédito</strong> ou 
              tente novamente em breve.
            </p>
          </div>
          <div className="pt-4 border-t border-amber-200">
            <p className="text-xs text-amber-500">
              Previsão de retorno: Em breve
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
