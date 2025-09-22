import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Download, RefreshCw, FileText, Calendar } from "lucide-react";

interface KPIs {
  totalBruto: number;
  totalEstornos: number;
  totalTaxas: number;
  totalLiquido: number;
  conversao: number;
  inadimplencia: number;
}

interface Filters {
  from: string;
  to: string;
  tipo?: string;
  metodo?: string;
  status?: string;
}

interface ExportJob {
  id: string;
  format: string;
  scope: string;
  status: string;
  rows_count?: number;
  created_at: string;
  finished_at?: string;
  download_url?: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

export default function Reports() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filters>({
    from: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });
  
  const [kpis, setKpis] = useState<KPIs>({
    totalBruto: 0,
    totalEstornos: 0,
    totalTaxas: 0,
    totalLiquido: 0,
    conversao: 0,
    inadimplencia: 0
  });
  
  const [chartData, setChartData] = useState({
    daily: [],
    methods: [],
    status: []
  });
  
  const [tableData, setTableData] = useState<any[]>([]);
  const [currentTable, setCurrentTable] = useState('transactions');
  const [loading, setLoading] = useState(false);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const { data, error } = await supabase.functions.invoke('admin-reports/summary', {
        method: 'GET',
      });

      if (error) throw error;

      setKpis(data.kpis);
      setChartData(data.charts);
    } catch (error) {
      console.error('Error loading summary:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar resumo dos relatórios",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (entity: string) => {
    try {
      const params = new URLSearchParams();
      params.append('entity', entity);
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const { data, error } = await supabase.functions.invoke('admin-reports/table', {
        method: 'GET',
      });

      if (error) throw error;

      setTableData(data.data || []);
    } catch (error) {
      console.error('Error loading table data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da tabela",
        variant: "destructive"
      });
    }
  };

  const exportData = async (entity: string, format: 'CSV' | 'XLSX') => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-reports/export', {
        body: {
          entity,
          format,
          filters
        }
      });

      if (error) throw error;

      toast({
        title: "Exportação iniciada",
        description: `Exportação ${format} de ${entity} foi criada. Verifique a seção de exportações.`
      });

      loadExportJobs();
    } catch (error) {
      console.error('Error creating export:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar exportação",
        variant: "destructive"
      });
    }
  };

  const loadExportJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('export_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Para cada job DONE, buscar URL de download
      const jobsWithUrls = await Promise.all(
        (data || []).map(async (job) => {
          if (job.status === 'DONE') {
            try {
              const { data: jobData } = await supabase.functions.invoke(`admin-reports/export/${job.id}`);
              return { ...job, download_url: jobData?.download_url };
            } catch {
              return job;
            }
          }
          return job;
        })
      );

      setExportJobs(jobsWithUrls);
    } catch (error) {
      console.error('Error loading export jobs:', error);
    }
  };

  const runExportWorker = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('export-worker', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Worker executado",
        description: data.message || "Worker de exportação executado com sucesso"
      });

      setTimeout(loadExportJobs, 2000);
    } catch (error) {
      console.error('Error running export worker:', error);
      toast({
        title: "Erro",
        description: "Erro ao executar worker de exportação",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    loadSummary();
    loadExportJobs();
  }, [filters]);

  useEffect(() => {
    if (currentTable) {
      loadTableData(currentTable);
    }
  }, [currentTable, filters]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Relatórios Admin</h1>
        <Button onClick={runExportWorker} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Processar Exportações
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">De</label>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Até</label>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <Select value={filters.tipo || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, tipo: value === 'all' ? undefined : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pontual">Pontual</SelectItem>
                  <SelectItem value="recorrente">Recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Método</label>
              <Select value={filters.metodo || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, metodo: value === 'all' ? undefined : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="CARD">Cartão</SelectItem>
                  <SelectItem value="QUITA">Quita+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={filters.status || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === 'all' ? undefined : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recebido Bruto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(kpis.totalBruto)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Estornos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(kpis.totalEstornos)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Taxas de Estorno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(kpis.totalTaxas)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recebido Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(kpis.totalLiquido)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.conversao.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Inadimplência Rec.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {kpis.inadimplencia.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Receita Diária</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receita por Método</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.methods}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="method" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabelas */}
      <Card>
        <CardHeader>
          <CardTitle>Dados Detalhados</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={currentTable} onValueChange={setCurrentTable}>
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="transactions">Transações</TabsTrigger>
                <TabsTrigger value="charges">Cobranças</TabsTrigger>
                <TabsTrigger value="executions">Execuções</TabsTrigger>
                <TabsTrigger value="splits">Splits</TabsTrigger>
              </TabsList>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => exportData(currentTable, 'CSV')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportData(currentTable, 'XLSX')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  XLSX
                </Button>
              </div>
            </div>

            <TabsContent value="transactions">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Pagador</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}...</TableCell>
                      <TableCell>{item.payer_name}</TableCell>
                      <TableCell>{formatCurrency((item.amount_in_cents || 0) / 100)}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'concluded' ? 'default' : 'secondary'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="charges">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Pagador</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}...</TableCell>
                      <TableCell>{item.payer_name}</TableCell>
                      <TableCell>{formatCurrency((item.amount || 0) / 100)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.recurrence_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'paid' ? 'default' : 'secondary'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="executions">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Cobrança</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Agendado Para</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}...</TableCell>
                      <TableCell className="font-mono text-xs">{item.charge_id?.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'SUCCESS' ? 'default' : 'secondary'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.scheduled_for ? format(new Date(item.scheduled_for), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>{item.attempts || 0}</TableCell>
                      <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="splits">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.method}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency((item.amount_cents || 0) / 100)}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'concluded' ? 'default' : 'secondary'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Exportações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Exportações</CardTitle>
          <CardDescription>Últimas 20 exportações criadas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Escopo</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registros</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exportJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Badge variant="outline">{job.scope}</Badge>
                  </TableCell>
                  <TableCell>{job.format}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        job.status === 'DONE' ? 'default' : 
                        job.status === 'FAILED' ? 'destructive' : 
                        'secondary'
                      }
                    >
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{job.rows_count || '-'}</TableCell>
                  <TableCell>
                    {format(new Date(job.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {job.status === 'DONE' && job.download_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(job.download_url, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}