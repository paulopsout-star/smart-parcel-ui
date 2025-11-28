import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, Radio, Play, TestTube, Info } from 'lucide-react';
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tokenResult, setTokenResult] = useState<TestResult | null>(null);
  const [simulationResult, setSimulationResult] = useState<TestResult | null>(null);
  const { toast } = useToast();

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
              
              {tokenResult.response && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Resposta:</p>
                  <ScrollArea className="h-32 w-full rounded border p-2">
                    <pre className="text-xs">
                      {JSON.stringify(tokenResult.response, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
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
              
              {simulationResult.response && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Resposta:</p>
                  <ScrollArea className="h-32 w-full rounded border p-2">
                    <pre className="text-xs">
                      {JSON.stringify(simulationResult.response, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
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
              <span className="text-muted-foreground">quitaplus-token, quitaplus-simulation</span>
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
