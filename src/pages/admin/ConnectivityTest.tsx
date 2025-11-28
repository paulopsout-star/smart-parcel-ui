import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, Radio, Play, TestTube, Info, CreditCard, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface TestResult {
  status: number;
  statusText: string;
  duration: number;
  request?: any;
  response?: any;
  error?: string;
}

export default function ConnectivityTest() {
  const [tokenStatus, setTokenStatus] = useState<ConnectionStatus>('idle');
  const [simulationStatus, setSimulationStatus] = useState<ConnectionStatus>('idle');
  const [prepaymentStatus, setPrepaymentStatus] = useState<ConnectionStatus>('idle');
  const [linkBoletoStatus, setLinkBoletoStatus] = useState<ConnectionStatus>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tokenResult, setTokenResult] = useState<TestResult | null>(null);
  const [simulationResult, setSimulationResult] = useState<TestResult | null>(null);
  const [prepaymentResult, setPrepaymentResult] = useState<TestResult | null>(null);
  const [linkBoletoResult, setLinkBoletoResult] = useState<TestResult | null>(null);
  const { toast } = useToast();

  // Estado do formulário de pré-pagamento
  const [prepaymentForm, setPrepaymentForm] = useState({
    chargeId: crypto.randomUUID(),
    paymentLinkId: crypto.randomUUID(),
    amount: '100.00',
    installments: '1',
    cardHolderName: 'TESTE USUARIO',
    cardNumber: '4111111111111111',
    cardExpirationDate: '12/30',
    cardCvv: '123',
    payerName: 'Teste Usuário',
    payerDocument: '12345678900',
    payerEmail: 'teste@exemplo.com',
    payerPhoneNumber: '11999999999'
  });

  // Estado do formulário de vínculo de boleto
  const [linkBoletoForm, setLinkBoletoForm] = useState({
    prePaymentKey: '',
    paymentLinkId: crypto.randomUUID(),
    boletoNumber: '07790001161210147229304375381466112160000000250',
    creditorDocument: '54329414000198',
    creditorName: 'AUTONEGOCIE'
  });

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const maskCredential = (value: string | undefined) => {
    if (!value) return '***';
    if (value.length <= 8) return '***';
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  };

  const testToken = async () => {
    setTokenStatus('testing');
    setTokenResult(null);
    addLog('🔄 Iniciando teste de token...', 'info');
    
    const startTime = Date.now();
    
    try {
      addLog('📤 Enviando requisição para quitaplus-token', 'info');
      
      const { data, error } = await supabase.functions.invoke('quitaplus-token', {
        body: {}
      });
      
      const duration = Date.now() - startTime;
      
      if (error) {
        addLog(`❌ Erro na requisição: ${error.message}`, 'error');
        setTokenResult({
          status: 500,
          statusText: 'Error',
          duration,
          error: error.message,
          response: error
        });
        setTokenStatus('error');
        toast({
          title: 'Erro no teste',
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      const status = data?.status || (data?.accessToken ? 200 : 403);
      const statusText = data?.accessToken ? 'OK' : (data?.message || 'Forbidden');
      
      addLog(`📥 Resposta recebida: ${status} (${duration}ms)`, status === 200 ? 'success' : 'error');
      
      if (status === 403) {
        addLog('🛡️ Detectado: WAF bloqueando requisição por IP dinâmico', 'error');
        addLog('💡 Solução: Implementar proxy com IP fixo', 'info');
      }
      
      setTokenResult({
        status,
        statusText,
        duration,
        response: data
      });
      
      setTokenStatus(status === 200 ? 'success' : 'error');
      
      if (status === 200) {
        toast({
          title: 'Token obtido com sucesso!',
          description: `Tempo de resposta: ${duration}ms`
        });
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      addLog(`💥 Exceção capturada: ${err.message}`, 'error');
      setTokenResult({
        status: 0,
        statusText: 'Network Error',
        duration,
        error: err.message
      });
      setTokenStatus('error');
      toast({
        title: 'Erro inesperado',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  const testSimulation = async () => {
    setSimulationStatus('testing');
    setSimulationResult(null);
    addLog('🔄 Iniciando teste de simulação...', 'info');
    
    const startTime = Date.now();
    
    try {
      addLog('📤 Enviando requisição para quitaplus-simulation', 'info');
      
      const { data, error } = await supabase.functions.invoke('quitaplus-simulation', {
        body: { amountInCents: 10000 } // R$ 100,00
      });
      
      const duration = Date.now() - startTime;
      
      if (error) {
        addLog(`❌ Erro na requisição: ${error.message}`, 'error');
        setSimulationResult({
          status: 500,
          statusText: 'Error',
          duration,
          error: error.message,
          response: error
        });
        setSimulationStatus('error');
        return;
      }

      const status = data?.success ? 200 : 403;
      const statusText = data?.success ? 'OK' : 'Error';
      
      addLog(`📥 Resposta recebida: ${status} (${duration}ms)`, status === 200 ? 'success' : 'error');
      
      if (!data?.success) {
        addLog('🛡️ Simulação falhou - verifique token e configurações', 'error');
      }
      
      setSimulationResult({
        status,
        statusText,
        duration,
        response: data
      });
      
      setSimulationStatus(status === 200 ? 'success' : 'error');
      
      if (status === 200) {
        toast({
          title: 'Simulação executada com sucesso!',
          description: `Tempo de resposta: ${duration}ms`
        });
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      addLog(`💥 Exceção capturada: ${err.message}`, 'error');
      setSimulationResult({
        status: 0,
        statusText: 'Network Error',
        duration,
        error: err.message
      });
      setSimulationStatus('error');
    }
  };

  const testPrepayment = async () => {
    setPrepaymentStatus('testing');
    setPrepaymentResult(null);
    addLog('🔄 Iniciando teste de pré-pagamento...', 'info');
    
    const startTime = Date.now();
    
    try {
      const amountInCents = Math.round(parseFloat(prepaymentForm.amount) * 100);
      
      addLog('📤 Enviando requisição para quitaplus-prepayment', 'info');
      
      const { data, error } = await supabase.functions.invoke('quitaplus-prepayment', {
        body: {
          chargeId: prepaymentForm.chargeId,
          paymentLinkId: prepaymentForm.paymentLinkId,
          amount: amountInCents,
          installments: parseInt(prepaymentForm.installments),
          card: {
            holderName: prepaymentForm.cardHolderName,
            number: prepaymentForm.cardNumber,
            expirationDate: prepaymentForm.cardExpirationDate,
            cvv: prepaymentForm.cardCvv
          },
          payer: {
            name: prepaymentForm.payerName,
            document: prepaymentForm.payerDocument,
            email: prepaymentForm.payerEmail,
            phoneNumber: prepaymentForm.payerPhoneNumber
          }
        }
      });
      
      const duration = Date.now() - startTime;
      
      if (error) {
        addLog(`❌ Erro na requisição: ${error.message}`, 'error');
        setPrepaymentResult({
          status: 500,
          statusText: 'Error',
          duration,
          error: error.message,
          response: error
        });
        setPrepaymentStatus('error');
        toast({
          title: 'Erro no teste',
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      const success = data?.success || false;
      const status = success ? 200 : 403;
      
      addLog(`📥 Resposta recebida: ${status} (${duration}ms)`, success ? 'success' : 'error');
      
      if (success && data?.prePaymentKey) {
        addLog(`✅ PrePaymentKey obtida: ${maskCredential(data.prePaymentKey)}`, 'success');
        // Auto-preencher no formulário de boleto
        setLinkBoletoForm(prev => ({
          ...prev,
          prePaymentKey: data.prePaymentKey
        }));
      }
      
      setPrepaymentResult({
        status,
        statusText: success ? 'OK' : 'Error',
        duration,
        response: data
      });
      
      setPrepaymentStatus(success ? 'success' : 'error');
      
      if (success) {
        toast({
          title: 'Pré-pagamento executado com sucesso!',
          description: `PrePaymentKey: ${maskCredential(data?.prePaymentKey)}`
        });
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      addLog(`💥 Exceção capturada: ${err.message}`, 'error');
      setPrepaymentResult({
        status: 0,
        statusText: 'Network Error',
        duration,
        error: err.message
      });
      setPrepaymentStatus('error');
    }
  };

  const testLinkBoleto = async () => {
    if (!linkBoletoForm.prePaymentKey) {
      toast({
        title: 'PrePaymentKey obrigatória',
        description: 'Execute o pré-pagamento primeiro ou insira uma chave válida.',
        variant: 'destructive'
      });
      return;
    }

    setLinkBoletoStatus('testing');
    setLinkBoletoResult(null);
    addLog('🔄 Iniciando teste de vínculo de boleto...', 'info');
    
    const startTime = Date.now();
    
    try {
      addLog('📤 Enviando requisição para quitaplus-link-boleto', 'info');
      
      const { data, error } = await supabase.functions.invoke('quitaplus-link-boleto', {
        body: {
          prePaymentKey: linkBoletoForm.prePaymentKey,
          paymentLinkId: linkBoletoForm.paymentLinkId,
          boleto: {
            number: linkBoletoForm.boletoNumber,
            creditorDocument: linkBoletoForm.creditorDocument,
            creditorName: linkBoletoForm.creditorName
          }
        }
      });
      
      const duration = Date.now() - startTime;
      
      if (error) {
        addLog(`❌ Erro na requisição: ${error.message}`, 'error');
        setLinkBoletoResult({
          status: 500,
          statusText: 'Error',
          duration,
          error: error.message,
          response: error
        });
        setLinkBoletoStatus('error');
        toast({
          title: 'Erro no teste',
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      const success = data?.success || false;
      const status = success ? 200 : 403;
      
      addLog(`📥 Resposta recebida: ${status} (${duration}ms)`, success ? 'success' : 'error');
      
      if (success) {
        addLog('✅ Boleto vinculado com sucesso!', 'success');
      }
      
      setLinkBoletoResult({
        status,
        statusText: success ? 'OK' : 'Error',
        duration,
        response: data
      });
      
      setLinkBoletoStatus(success ? 'success' : 'error');
      
      if (success) {
        toast({
          title: 'Boleto vinculado com sucesso!',
          description: `Tempo de resposta: ${duration}ms`
        });
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      addLog(`💥 Exceção capturada: ${err.message}`, 'error');
      setLinkBoletoResult({
        status: 0,
        statusText: 'Network Error',
        duration,
        error: err.message
      });
      setLinkBoletoStatus('error');
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('🗑️ Logs limpos', 'info');
  };

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case 'idle':
        return <Radio className="w-5 h-5 text-muted-foreground" />;
      case 'testing':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-destructive" />;
    }
  };

  const getStatusBadge = (status: ConnectionStatus) => {
    const variants: Record<ConnectionStatus, any> = {
      idle: 'secondary',
      testing: 'default',
      success: 'default',
      error: 'destructive'
    };
    const labels = {
      idle: 'Não testado',
      testing: 'Testando...',
      success: 'Conectado',
      error: 'Erro'
    };
    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🔌 Diagnóstico de Conectividade</h1>
          <p className="text-muted-foreground">QuitaPlus / Cappta API</p>
        </div>
      </div>

      {/* Status Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Status da Conexão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {getStatusIcon(tokenStatus)}
              <span className="font-medium">Token:</span>
              {getStatusBadge(tokenStatus)}
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              {getStatusIcon(simulationStatus)}
              <span className="font-medium">Simulação:</span>
              {getStatusBadge(simulationStatus)}
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              {getStatusIcon(prepaymentStatus)}
              <span className="font-medium">Pré-Pagamento:</span>
              {getStatusBadge(prepaymentStatus)}
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              {getStatusIcon(linkBoletoStatus)}
              <span className="font-medium">Vínculo Boleto:</span>
              {getStatusBadge(linkBoletoStatus)}
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={testToken} disabled={tokenStatus === 'testing'}>
              {tokenStatus === 'testing' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Testar Token
            </Button>
            <Button onClick={testSimulation} disabled={simulationStatus === 'testing'} variant="outline">
              {simulationStatus === 'testing' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4 mr-2" />
              )}
              Testar Simulação
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Testes de Pré-Pagamento e Vínculo de Boleto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            Testes de Pagamento
          </CardTitle>
          <CardDescription>
            Execute testes de pré-pagamento (cartão) e vínculo de boleto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="prepayment" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="prepayment" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Pré-Pagamento
              </TabsTrigger>
              <TabsTrigger value="boleto" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Vínculo Boleto
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="prepayment" className="space-y-4 mt-4">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Coluna 1: Dados do Cartão */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Dados do Cartão
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="cardNumber">Número do Cartão</Label>
                      <Input
                        id="cardNumber"
                        value={prepaymentForm.cardNumber}
                        onChange={(e) => setPrepaymentForm(prev => ({ ...prev, cardNumber: e.target.value }))}
                        placeholder="4111111111111111"
                        maxLength={16}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cardHolderName">Nome no Cartão</Label>
                      <Input
                        id="cardHolderName"
                        value={prepaymentForm.cardHolderName}
                        onChange={(e) => setPrepaymentForm(prev => ({ ...prev, cardHolderName: e.target.value }))}
                        placeholder="TESTE USUARIO"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="cardExpirationDate">Validade</Label>
                        <Input
                          id="cardExpirationDate"
                          value={prepaymentForm.cardExpirationDate}
                          onChange={(e) => setPrepaymentForm(prev => ({ ...prev, cardExpirationDate: e.target.value }))}
                          placeholder="MM/AA"
                          maxLength={5}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cardCvv">CVV</Label>
                        <Input
                          id="cardCvv"
                          value={prepaymentForm.cardCvv}
                          onChange={(e) => setPrepaymentForm(prev => ({ ...prev, cardCvv: e.target.value }))}
                          placeholder="123"
                          maxLength={4}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coluna 2: Dados do Pagador */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Dados do Pagador</h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="payerName">Nome</Label>
                      <Input
                        id="payerName"
                        value={prepaymentForm.payerName}
                        onChange={(e) => setPrepaymentForm(prev => ({ ...prev, payerName: e.target.value }))}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="payerDocument">CPF/CNPJ</Label>
                      <Input
                        id="payerDocument"
                        value={prepaymentForm.payerDocument}
                        onChange={(e) => setPrepaymentForm(prev => ({ ...prev, payerDocument: e.target.value }))}
                        placeholder="12345678900"
                      />
                    </div>
                    <div>
                      <Label htmlFor="payerEmail">Email</Label>
                      <Input
                        id="payerEmail"
                        type="email"
                        value={prepaymentForm.payerEmail}
                        onChange={(e) => setPrepaymentForm(prev => ({ ...prev, payerEmail: e.target.value }))}
                        placeholder="teste@exemplo.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="payerPhoneNumber">Telefone</Label>
                      <Input
                        id="payerPhoneNumber"
                        value={prepaymentForm.payerPhoneNumber}
                        onChange={(e) => setPrepaymentForm(prev => ({ ...prev, payerPhoneNumber: e.target.value }))}
                        placeholder="11999999999"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Valor e Parcelas */}
              <div className="grid md:grid-cols-2 gap-3 pt-4 border-t">
                <div>
                  <Label htmlFor="amount">Valor (R$)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={prepaymentForm.amount}
                    onChange={(e) => setPrepaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="100.00"
                  />
                </div>
                <div>
                  <Label htmlFor="installments">Parcelas</Label>
                  <Input
                    id="installments"
                    type="number"
                    min="1"
                    max="12"
                    value={prepaymentForm.installments}
                    onChange={(e) => setPrepaymentForm(prev => ({ ...prev, installments: e.target.value }))}
                    placeholder="1"
                  />
                </div>
              </div>

              <Button 
                onClick={testPrepayment} 
                disabled={prepaymentStatus === 'testing'}
                className="w-full"
              >
                {prepaymentStatus === 'testing' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Executar Pré-Pagamento
              </Button>
            </TabsContent>
            
            <TabsContent value="boleto" className="space-y-4 mt-4">
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Execute primeiro o pré-pagamento para obter a PrePaymentKey, ou insira uma chave válida manualmente.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="prePaymentKey">PrePaymentKey *</Label>
                  <Input
                    id="prePaymentKey"
                    value={linkBoletoForm.prePaymentKey}
                    onChange={(e) => setLinkBoletoForm(prev => ({ ...prev, prePaymentKey: e.target.value }))}
                    placeholder="Chave obtida no pré-pagamento"
                    className={linkBoletoForm.prePaymentKey ? 'border-green-500' : ''}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {linkBoletoForm.prePaymentKey ? '✅ Preenchido automaticamente' : 'Aguardando pré-pagamento...'}
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="boletoNumber">Linha Digitável do Boleto</Label>
                  <Input
                    id="boletoNumber"
                    value={linkBoletoForm.boletoNumber}
                    onChange={(e) => setLinkBoletoForm(prev => ({ ...prev, boletoNumber: e.target.value }))}
                    placeholder="47-48 dígitos"
                    maxLength={48}
                  />
                </div>
                
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="creditorDocument">Documento do Credor</Label>
                    <Input
                      id="creditorDocument"
                      value={linkBoletoForm.creditorDocument}
                      onChange={(e) => setLinkBoletoForm(prev => ({ ...prev, creditorDocument: e.target.value }))}
                      placeholder="CNPJ sem pontuação"
                    />
                  </div>
                  <div>
                    <Label htmlFor="creditorName">Nome do Credor</Label>
                    <Input
                      id="creditorName"
                      value={linkBoletoForm.creditorName}
                      onChange={(e) => setLinkBoletoForm(prev => ({ ...prev, creditorName: e.target.value }))}
                      placeholder="Nome da empresa"
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={testLinkBoleto} 
                disabled={linkBoletoStatus === 'testing' || !linkBoletoForm.prePaymentKey}
                className="w-full"
              >
                {linkBoletoStatus === 'testing' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Vincular Boleto
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Resultados */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Token Result */}
        {tokenResult && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resultado - Token</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Status:</span>
                  <Badge variant={tokenResult.status === 200 ? 'default' : 'destructive'}>
                    {tokenResult.status} {tokenResult.statusText}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Tempo:</span>
                  <span>{tokenResult.duration}ms</span>
                </div>
              </div>
              
              {tokenResult.error && (
                <Alert variant="destructive">
                  <AlertDescription>{tokenResult.error}</AlertDescription>
                </Alert>
              )}
              
              <Tabs defaultValue="response" className="w-full mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="response">Resposta Completa</TabsTrigger>
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="response" className="mt-2">
                  <ScrollArea className="h-64 w-full rounded border p-3 bg-muted/30">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(tokenResult.response, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="details" className="mt-2 space-y-3">
                  {tokenResult.response?.accessToken && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Access Token:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded block overflow-x-auto">
                        {maskCredential(tokenResult.response.accessToken)}
                      </code>
                    </div>
                  )}
                  {tokenResult.response?.expiresIn && (
                    <div className="flex justify-between text-sm border-b pb-2">
                      <span className="font-medium">Expira em:</span>
                      <span>{tokenResult.response.expiresIn}s</span>
                    </div>
                  )}
                  {tokenResult.response?.error && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Erro Retornado:</span>
                      <ScrollArea className="h-32 w-full rounded border p-2 bg-destructive/5">
                        <pre className="text-xs whitespace-pre-wrap break-words text-destructive">
                          {typeof tokenResult.response.error === 'string' 
                            ? tokenResult.response.error 
                            : JSON.stringify(tokenResult.response.error, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Simulation Result */}
        {simulationResult && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resultado - Simulação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Status:</span>
                  <Badge variant={simulationResult.status === 200 ? 'default' : 'destructive'}>
                    {simulationResult.status} {simulationResult.statusText}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Tempo:</span>
                  <span>{simulationResult.duration}ms</span>
                </div>
              </div>
              
              {simulationResult.error && (
                <Alert variant="destructive">
                  <AlertDescription>{simulationResult.error}</AlertDescription>
                </Alert>
              )}
              
              <Tabs defaultValue="response" className="w-full mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="response">Resposta Completa</TabsTrigger>
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="response" className="mt-2">
                  <ScrollArea className="h-64 w-full rounded border p-3 bg-muted/30">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(simulationResult.response, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="details" className="mt-2 space-y-3">
                  {simulationResult.response?.success !== undefined && (
                    <div className="flex justify-between text-sm border-b pb-2">
                      <span className="font-medium">Success:</span>
                      <Badge variant={simulationResult.response.success ? 'default' : 'destructive'}>
                        {simulationResult.response.success ? 'true' : 'false'}
                      </Badge>
                    </div>
                  )}
                  {simulationResult.response?.error && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Erro Retornado:</span>
                      <ScrollArea className="h-32 w-full rounded border p-2 bg-destructive/5">
                        <pre className="text-xs whitespace-pre-wrap break-words text-destructive">
                          {typeof simulationResult.response.error === 'string' 
                            ? simulationResult.response.error 
                            : JSON.stringify(simulationResult.response.error, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                  {simulationResult.response?.message && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Mensagem:</span>
                      <p className="text-sm text-muted-foreground p-2 bg-muted rounded">
                        {simulationResult.response.message}
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Prepayment Result */}
        {prepaymentResult && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resultado - Pré-Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Status:</span>
                  <Badge variant={prepaymentResult.status === 200 ? 'default' : 'destructive'}>
                    {prepaymentResult.status} {prepaymentResult.statusText}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Tempo:</span>
                  <span>{prepaymentResult.duration}ms</span>
                </div>
                {prepaymentResult.response?.prePaymentKey && (
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">PrePaymentKey:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {maskCredential(prepaymentResult.response.prePaymentKey)}
                    </code>
                  </div>
                )}
              </div>
              
              {prepaymentResult.error && (
                <Alert variant="destructive">
                  <AlertDescription>{prepaymentResult.error}</AlertDescription>
                </Alert>
              )}
              
              <Tabs defaultValue="response" className="w-full mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="response">Resposta Completa</TabsTrigger>
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="response" className="mt-2">
                  <ScrollArea className="h-64 w-full rounded border p-3 bg-muted/30">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(prepaymentResult.response, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="details" className="mt-2 space-y-3">
                  {prepaymentResult.response?.success !== undefined && (
                    <div className="flex justify-between text-sm border-b pb-2">
                      <span className="font-medium">Success:</span>
                      <Badge variant={prepaymentResult.response.success ? 'default' : 'destructive'}>
                        {prepaymentResult.response.success ? 'true' : 'false'}
                      </Badge>
                    </div>
                  )}
                  {prepaymentResult.response?.code && (
                    <div className="flex justify-between text-sm border-b pb-2">
                      <span className="font-medium">Code:</span>
                      <Badge variant="outline">{prepaymentResult.response.code}</Badge>
                    </div>
                  )}
                  {prepaymentResult.response?.error && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Erro Retornado:</span>
                      <ScrollArea className="h-32 w-full rounded border p-2 bg-destructive/5">
                        <pre className="text-xs whitespace-pre-wrap break-words text-destructive">
                          {typeof prepaymentResult.response.error === 'string' 
                            ? prepaymentResult.response.error 
                            : JSON.stringify(prepaymentResult.response.error, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                  {prepaymentResult.response?.message && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Mensagem:</span>
                      <p className="text-sm text-muted-foreground p-2 bg-muted rounded">
                        {prepaymentResult.response.message}
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Link Boleto Result */}
        {linkBoletoResult && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resultado - Vínculo Boleto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Status:</span>
                  <Badge variant={linkBoletoResult.status === 200 ? 'default' : 'destructive'}>
                    {linkBoletoResult.status} {linkBoletoResult.statusText}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Tempo:</span>
                  <span>{linkBoletoResult.duration}ms</span>
                </div>
              </div>
              
              {linkBoletoResult.error && (
                <Alert variant="destructive">
                  <AlertDescription>{linkBoletoResult.error}</AlertDescription>
                </Alert>
              )}
              
              <Tabs defaultValue="response" className="w-full mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="response">Resposta Completa</TabsTrigger>
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="response" className="mt-2">
                  <ScrollArea className="h-64 w-full rounded border p-3 bg-muted/30">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(linkBoletoResult.response, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="details" className="mt-2 space-y-3">
                  {linkBoletoResult.response?.success !== undefined && (
                    <div className="flex justify-between text-sm border-b pb-2">
                      <span className="font-medium">Success:</span>
                      <Badge variant={linkBoletoResult.response.success ? 'default' : 'destructive'}>
                        {linkBoletoResult.response.success ? 'true' : 'false'}
                      </Badge>
                    </div>
                  )}
                  {linkBoletoResult.response?.code && (
                    <div className="flex justify-between text-sm border-b pb-2">
                      <span className="font-medium">Code:</span>
                      <Badge variant="outline">{linkBoletoResult.response.code}</Badge>
                    </div>
                  )}
                  {linkBoletoResult.response?.error && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Erro Retornado:</span>
                      <ScrollArea className="h-32 w-full rounded border p-2 bg-destructive/5">
                        <pre className="text-xs whitespace-pre-wrap break-words text-destructive">
                          {typeof linkBoletoResult.response.error === 'string' 
                            ? linkBoletoResult.response.error 
                            : JSON.stringify(linkBoletoResult.response.error, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                  {linkBoletoResult.response?.message && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Mensagem:</span>
                      <p className="text-sm text-muted-foreground p-2 bg-muted rounded">
                        {linkBoletoResult.response.message}
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Logs em Tempo Real */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>📋 Logs em Tempo Real</CardTitle>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 w-full rounded border p-4 bg-muted/30">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum log ainda. Execute um teste.</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, idx) => (
                  <div key={idx} className="text-sm font-mono">
                    <span className="text-muted-foreground">[{log.timestamp}]</span>{' '}
                    <span className={
                      log.type === 'error' ? 'text-destructive' :
                      log.type === 'success' ? 'text-green-600' :
                      'text-foreground'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Informações do Ambiente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Informações do Ambiente
          </CardTitle>
          <CardDescription>
            Configurações do sistema (dados sensíveis mascarados)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Base URL:</span>
              <span className="text-muted-foreground">https://api.cappta.com.br</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Merchant ID:</span>
              <span className="text-muted-foreground">{maskCredential('54.329.414/0001-98')}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Client ID:</span>
              <span className="text-muted-foreground">{maskCredential('configured')}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Edge Functions:</span>
              <span className="text-muted-foreground text-xs">
                quitaplus-token, quitaplus-simulation, quitaplus-prepayment, quitaplus-link-boleto
              </span>
            </div>
          </div>

          <Separator className="my-4" />

          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              <strong>Problema Identificado:</strong> A API Cappta/QuitaPlus está protegida por WAF (Akamai) 
              que bloqueia requisições de IPs dinâmicos. As Edge Functions do Supabase usam IPs dinâmicos, 
              resultando em erros 403 (Access Denied).
              <br /><br />
              <strong>Solução:</strong> Implementar proxy com IP fixo e solicitar whitelist à Cappta.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
