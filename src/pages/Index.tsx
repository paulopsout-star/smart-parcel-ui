import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  CreditCard, 
  Shield, 
  Clock, 
  Users, 
  CheckCircle,
  ArrowRight,
  Zap,
  BarChart3,
  FileText,
  HeadphonesIcon,
  Star,
  Play
} from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* SEO Meta Tags */}
      <title>Autonegocie - Hub de Pagamentos | Plataforma Completa de Cobrança</title>
      <meta name="description" content="Hub de Pagamentos Autonegocie - Plataforma completa para gestão de cobranças, parcelamentos flexíveis e recebimento garantido. Transforme sua negociação com clientes." />
      <meta property="og:title" content="Autonegocie - Hub de Pagamentos | Plataforma Completa de Cobrança" />
      <meta property="og:description" content="Hub de Pagamentos Autonegocie - Plataforma completa para gestão de cobranças, parcelamentos flexíveis e recebimento garantido." />
      <meta property="og:type" content="website" />
      <meta name="robots" content="index, follow" />
      
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold bg-gradient-brand bg-clip-text text-transparent">
                Autonegocie
              </div>
              <Badge variant="secondary" className="text-xs">Hub de Pagamentos</Badge>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#recursos" className="text-foreground/80 hover:text-brand transition-colors">Recursos</a>
              <a href="#como-funciona" className="text-foreground/80 hover:text-brand transition-colors">Como funciona</a>
              <a href="#casos-de-uso" className="text-foreground/80 hover:text-brand transition-colors">Casos de uso</a>
              <a href="#faq" className="text-foreground/80 hover:text-brand transition-colors">FAQ</a>
            </nav>
            <div className="flex items-center space-x-3">
              <Link to="/login">
                <Button variant="ghost" className="text-foreground hover:text-brand">
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-brand hover:bg-brand-dark text-brand-foreground">
                  Começar Agora
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-hero opacity-10"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KPGcgZmlsbD0iIzAwZmY4OCIgZmlsbC1vcGFjaXR5PSIwLjAzIj4KPGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIvPgo8L2c+CjwvZz4KPC9zdmc+')] opacity-20"></div>
          
          <div className="container mx-auto px-4 relative">
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                Potencialize a <span className="bg-gradient-brand bg-clip-text text-transparent">negociação</span> de cobranças com seus clientes
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
                Ofereça parcelamentos flexíveis em até 21x no cartão com recebimento garantido em 1 dia útil. Transforme inadimplência em oportunidade.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                <Link to="/register">
                  <Button size="lg" className="bg-brand hover:bg-brand-dark text-brand-foreground px-8 py-6 text-lg">
                    Começar Agora
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/payment">
                  <Button variant="outline" size="lg" className="px-8 py-6 text-lg border-brand text-brand hover:bg-brand-light">
                    <Play className="mr-2 h-5 w-5" />
                    Ver Demo
                  </Button>
                </Link>
              </div>
              
              {/* Trust indicators */}
              <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-brand" />
                  100% Seguro
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-brand" />
                  Recebimento em 1 dia
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-brand" />
                  Zero taxas
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recursos Section */}
        <section id="recursos" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Recursos que <span className="text-brand">garantem resultados</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Ferramentas poderosas para otimizar sua gestão de cobranças e aumentar a conversão
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 bg-brand-light rounded-lg flex items-center justify-center mb-4">
                    <CreditCard className="h-6 w-6 text-brand" />
                  </div>
                  <CardTitle>Parcelamento Flexível</CardTitle>
                  <CardDescription>
                    Ofereça até 21x no cartão com recebimento integral à vista em 1 dia útil
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-brand" />
                      Até 9 cartões diferentes
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-brand" />
                      Sem desconto de taxas
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-brand" />
                      Aprovação automática
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 bg-brand-light rounded-lg flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-brand" />
                  </div>
                  <CardTitle>Segurança Total</CardTitle>
                  <CardDescription>
                    Zero chargeback e total proteção contra fraudes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-brand" />
                      Antifraude avançado
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-brand" />
                      Proteção garantida
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-brand" />
                      Dados criptografados
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 bg-brand-light rounded-lg flex items-center justify-center mb-4">
                    <BarChart3 className="h-6 w-6 text-brand" />
                  </div>
                  <CardTitle>Gestão Inteligente</CardTitle>
                  <CardDescription>
                    Dashboard completo com relatórios e analytics em tempo real
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-brand" />
                      Relatórios detalhados
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-brand" />
                      Métricas de conversão
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-brand" />
                      Exportação de dados
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Como Funciona Section */}
        <section id="como-funciona" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Como funciona o <span className="text-brand">Hub de Pagamentos</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Processo simples e eficiente em poucos passos
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-brand rounded-full flex items-center justify-center text-brand-foreground text-2xl font-bold mb-4 mx-auto">
                  1
                </div>
                <h3 className="text-xl font-semibold mb-2">Crie seu Link</h3>
                <p className="text-muted-foreground">
                  Gere links de pagamento personalizados com suas condições e valores
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-brand rounded-full flex items-center justify-center text-brand-foreground text-2xl font-bold mb-4 mx-auto">
                  2
                </div>
                <h3 className="text-xl font-semibold mb-2">Envie ao Cliente</h3>
                <p className="text-muted-foreground">
                  Compartilhe via WhatsApp, email ou SMS. Cliente escolhe a melhor forma de pagar
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-brand rounded-full flex items-center justify-center text-brand-foreground text-2xl font-bold mb-4 mx-auto">
                  3
                </div>
                <h3 className="text-xl font-semibold mb-2">Receba em 1 Dia</h3>
                <p className="text-muted-foreground">
                  Valor integral creditado em sua conta em 1 dia útil, sem descontos
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Casos de Uso Section */}
        <section id="casos-de-uso" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Casos de <span className="text-brand">uso ideais</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Solução perfeita para diversos segmentos e necessidades
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="text-center border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <FileText className="h-12 w-12 text-brand mx-auto mb-4" />
                  <CardTitle className="text-lg">Escritórios de Advocacia</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Negociação de dívidas e acordos judiciais com parcelamento flexível
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <Users className="h-12 w-12 text-brand mx-auto mb-4" />
                  <CardTitle className="text-lg">Empresas de Cobrança</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Recuperação de crédito com opções atrativas de pagamento
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <Zap className="h-12 w-12 text-brand mx-auto mb-4" />
                  <CardTitle className="text-lg">Concessionárias</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Negociação de débitos de energia, água e telecomunicações
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <HeadphonesIcon className="h-12 w-12 text-brand mx-auto mb-4" />
                  <CardTitle className="text-lg">Call Centers</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Fechamento de acordos telefônicos com confirmação imediata
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Depoimentos Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                O que nossos <span className="text-brand">clientes dizem</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Resultados comprovados de quem já transformou sua cobrança
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-4 w-4 fill-brand text-brand" />
                    ))}
                  </div>
                  <CardDescription>
                    "Aumentamos nossa taxa de conversão em 340% no primeiro mês. A facilidade de parcelamento transformou nossa operação."
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-semibold">Ana Silva</div>
                  <div className="text-sm text-muted-foreground">Diretora Comercial - Empresa de Cobrança</div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-4 w-4 fill-brand text-brand" />
                    ))}
                  </div>
                  <CardDescription>
                    "Receber em 1 dia útil mudou nosso fluxo de caixa. Agora oferecemos condições que nossos clientes realmente conseguem pagar."
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-semibold">Carlos Santos</div>
                  <div className="text-sm text-muted-foreground">Sócio - Escritório de Advocacia</div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-4 w-4 fill-brand text-brand" />
                    ))}
                  </div>
                  <CardDescription>
                    "A plataforma é intuitiva e nossos operadores se adaptaram rapidamente. Os relatórios são excelentes para acompanhar resultados."
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-semibold">Mariana Costa</div>
                  <div className="text-sm text-muted-foreground">Gerente Operacional - Call Center</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Perguntas <span className="text-brand">Frequentes</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Tire suas dúvidas sobre o Hub de Pagamentos Autonegocie
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <Accordion type="single" collapsible className="space-y-4">
                <AccordionItem value="item-1" className="bg-white rounded-lg px-6 border-0 shadow-sm">
                  <AccordionTrigger className="text-left hover:no-underline">
                    Como funciona o recebimento em 1 dia útil?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Quando seu cliente efetua o pagamento parcelado, você recebe o valor integral em sua conta em até 1 dia útil, sem desconto de taxas. Nós assumimos o risco do parcelamento.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2" className="bg-white rounded-lg px-6 border-0 shadow-sm">
                  <AccordionTrigger className="text-left hover:no-underline">
                    Existe limite de parcelamento?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Sim, oferecemos parcelamento em até 21 vezes no cartão de crédito. O cliente pode usar até 9 cartões diferentes para dividir o pagamento.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3" className="bg-white rounded-lg px-6 border-0 shadow-sm">
                  <AccordionTrigger className="text-left hover:no-underline">
                    Como é garantida a segurança das transações?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Utilizamos sistemas antifraude avançados, criptografia de dados e somos certificados pelos principais órgãos de segurança. Você tem proteção total contra chargeback.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4" className="bg-white rounded-lg px-6 border-0 shadow-sm">
                  <AccordionTrigger className="text-left hover:no-underline">
                    Posso integrar com meu sistema atual?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Sim, oferecemos APIs completas para integração com seu sistema de gestão, CRM ou plataforma de cobrança existente.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-5" className="bg-white rounded-lg px-6 border-0 shadow-sm">
                  <AccordionTrigger className="text-left hover:no-underline">
                    Existe custo de adesão ou mensalidade?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Não, nosso modelo é baseado apenas no sucesso das suas cobranças. Você só paga quando efetivamente receber pelos pagamentos processados.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </section>

        {/* CTA Final Section */}
        <section className="py-20 bg-gradient-brand text-brand-foreground relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="container mx-auto px-4 relative">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Pronto para transformar sua cobrança?
              </h2>
              <p className="text-xl mb-8 opacity-90">
                Junte-se a centenas de empresas que já aumentaram sua conversão com o Hub de Pagamentos Autonegocie
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link to="/register">
                  <Button size="lg" variant="secondary" className="px-8 py-6 text-lg bg-white text-brand hover:bg-gray-100">
                    Criar Conta Gratuita
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/payment">
                  <Button size="lg" variant="outline" className="px-8 py-6 text-lg border-white text-white hover:bg-white/10">
                    <Play className="mr-2 h-5 w-5" />
                    Testar Demo
                  </Button>
                </Link>
              </div>
              <p className="text-sm mt-6 opacity-75">
                Sem compromisso • Sem taxas de adesão • Suporte especializado
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background border-t py-8">
        <div className="container mx-auto px-4">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 Autonegocie Hub de Pagamentos. Todos os direitos reservados.</p>
            <p className="text-sm mt-2">Integração powered by Quita+</p>
          </div>
        </div>
      </footer>
    </div>
  );
}