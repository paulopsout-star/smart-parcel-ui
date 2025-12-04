import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight";
import { StatsCounter } from "@/components/StatsCounter";
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
  Play,
  Sparkles
} from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* SEO Meta Tags */}
      <title>Autonegocie - Hub de Pagamentos | Plataforma Completa de Cobrança</title>
      <meta name="description" content="Hub de Pagamentos Autonegocie - Plataforma completa para gestão de cobranças, parcelamentos flexíveis e recebimento garantido. Transforme sua negociação com clientes." />
      <meta property="og:title" content="Autonegocie - Hub de Pagamentos | Plataforma Completa de Cobrança" />
      <meta property="og:description" content="Hub de Pagamentos Autonegocie - Plataforma completa para gestão de cobranças, parcelamentos flexíveis e recebimento garantido." />
      <meta property="og:type" content="website" />
      <meta name="robots" content="index, follow" />
      
      {/* Header - Glassmorphism */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="text-2xl font-bold bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
                  Autonegocie
                </div>
                <div className="absolute -inset-2 bg-brand/20 blur-xl rounded-full opacity-50" />
              </div>
              <Badge variant="secondary" className="bg-brand/10 text-brand border border-brand/20">
                Hub de Pagamentos
              </Badge>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#recursos" className="link-underline text-muted-foreground hover:text-brand transition-colors">Recursos</a>
              <a href="#como-funciona" className="link-underline text-muted-foreground hover:text-brand transition-colors">Como funciona</a>
              <a href="#casos-de-uso" className="link-underline text-muted-foreground hover:text-brand transition-colors">Casos de uso</a>
              <a href="#faq" className="link-underline text-muted-foreground hover:text-brand transition-colors">FAQ</a>
            </nav>
            <div className="flex items-center space-x-3">
              <Link to="/login">
                <Button variant="ghost" className="text-muted-foreground hover:text-brand hover:bg-brand/5">
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-gradient-to-r from-brand to-accent hover:from-brand-dark hover:to-brand text-white shine-effect">
                  Começar Agora
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-20">
        {/* Hero Section - HeroHighlight */}
        <HeroHighlight containerClassName="py-20 md:py-32 overflow-hidden">
          {/* Background Effects */}
          <div className="absolute inset-0 mesh-gradient" />
          
          {/* Floating Orbs */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-brand/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/15 rounded-full blur-3xl animate-float-delayed" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand/5 rounded-full blur-3xl" />
          
          {/* Floating geometric shapes */}
          <div className="absolute top-32 right-20 w-20 h-20 border border-brand/20 rounded-2xl rotate-12 animate-float hidden lg:block" />
          <div className="absolute bottom-40 left-20 w-16 h-16 border border-accent/20 rounded-full animate-float-delayed hidden lg:block" />
          <div className="absolute top-1/2 right-40 w-12 h-12 bg-brand/10 rounded-lg rotate-45 animate-float hidden lg:block" />
          
          <div className="container mx-auto px-4 relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: [20, -5, 0] }}
              transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
              className="text-center max-w-5xl mx-auto"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand/10 border border-brand/20 mb-8">
                <Sparkles className="h-4 w-4 text-brand" />
                <span className="text-sm font-medium text-brand">Nova plataforma de cobranças</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8">
                Potencialize a{' '}
                <Highlight className="text-foreground">
                  negociação
                </Highlight>
                {' '}de cobranças
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground mb-10 leading-relaxed max-w-3xl mx-auto">
                Ofereça parcelamentos flexíveis em até <span className="text-brand font-semibold">21x no cartão</span> com recebimento garantido em <span className="text-brand font-semibold">1 dia útil</span>. Transforme inadimplência em oportunidade.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                <Link to="/register">
                  <Button size="lg" className="bg-gradient-to-r from-brand to-accent hover:from-brand-dark hover:to-brand text-white px-10 py-7 text-lg shadow-xl shadow-brand/25 btn-3d shine-effect group">
                    Começar Agora
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/payment">
                  <Button variant="outline" size="lg" className="px-10 py-7 text-lg border-2 border-brand/30 text-brand hover:bg-brand/5 hover:border-brand glass-card">
                    <Play className="mr-2 h-5 w-5" />
                    Ver Demo
                  </Button>
                </Link>
              </div>
              
              {/* Trust indicators - Glass Cards */}
              <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6">
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl glass-card">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand to-accent flex items-center justify-center">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-medium">100% Seguro</span>
                </div>
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl glass-card">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand to-accent flex items-center justify-center">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-medium">Recebimento em 1 dia</span>
                </div>
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl glass-card">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand to-accent flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-medium">Zero taxas</span>
                </div>
              </div>
            </motion.div>
          </div>
        </HeroHighlight>

        {/* Stats Section */}
        <StatsCounter />

        {/* Recursos Section - Glassmorphism Cards */}
        <section id="recursos" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 tech-dots opacity-30" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand/5 rounded-full blur-3xl" />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Recursos que{' '}
                <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
                  garantem resultados
                </span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Ferramentas poderosas para otimizar sua gestão de cobranças
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 stagger-children">
              {/* Card 1 */}
              <div className="group relative p-8 rounded-2xl glass-card hover:scale-[1.02] transition-all duration-500">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand to-accent flex items-center justify-center mb-6 icon-glow shadow-lg shadow-brand/20">
                    <CreditCard className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Parcelamento Flexível</h3>
                  <p className="text-muted-foreground mb-6">
                    Até 21x no cartão com recebimento integral à vista em 1 dia útil
                  </p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-brand flex-shrink-0" />
                      <span className="text-muted-foreground">Até 9 cartões diferentes</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-brand flex-shrink-0" />
                      <span className="text-muted-foreground">Sem desconto de taxas</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-brand flex-shrink-0" />
                      <span className="text-muted-foreground">Aprovação automática</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Card 2 */}
              <div className="group relative p-8 rounded-2xl glass-card hover:scale-[1.02] transition-all duration-500">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand to-accent flex items-center justify-center mb-6 icon-glow shadow-lg shadow-brand/20">
                    <Shield className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Segurança Total</h3>
                  <p className="text-muted-foreground mb-6">
                    Zero chargeback e total proteção contra fraudes
                  </p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-brand flex-shrink-0" />
                      <span className="text-muted-foreground">Antifraude avançado</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-brand flex-shrink-0" />
                      <span className="text-muted-foreground">Proteção garantida</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-brand flex-shrink-0" />
                      <span className="text-muted-foreground">Dados criptografados</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Card 3 */}
              <div className="group relative p-8 rounded-2xl glass-card hover:scale-[1.02] transition-all duration-500">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand to-accent flex items-center justify-center mb-6 icon-glow shadow-lg shadow-brand/20">
                    <BarChart3 className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Gestão Inteligente</h3>
                  <p className="text-muted-foreground mb-6">
                    Dashboard completo com relatórios e analytics em tempo real
                  </p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-brand flex-shrink-0" />
                      <span className="text-muted-foreground">Relatórios detalhados</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-brand flex-shrink-0" />
                      <span className="text-muted-foreground">Métricas de conversão</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-brand flex-shrink-0" />
                      <span className="text-muted-foreground">Exportação de dados</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Como Funciona Section - Timeline */}
        <section id="como-funciona" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-surface/50 to-background" />
          <div className="absolute inset-0 grid-pattern opacity-20" />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Como funciona o{' '}
                <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
                  Hub de Pagamentos
                </span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Processo simples e eficiente em poucos passos
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
              {/* Connector Line */}
              <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-brand via-accent to-brand opacity-30" />
              
              {/* Step 1 */}
              <div className="text-center group">
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-brand/30 group-hover:scale-110 transition-transform duration-300">
                    1
                  </div>
                  <div className="absolute -inset-2 bg-brand/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <h3 className="text-xl font-bold mb-3">Crie seu Link</h3>
                <p className="text-muted-foreground">
                  Gere links de pagamento personalizados com suas condições e valores
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center group">
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-brand/30 group-hover:scale-110 transition-transform duration-300">
                    2
                  </div>
                  <div className="absolute -inset-2 bg-brand/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <h3 className="text-xl font-bold mb-3">Envie ao Cliente</h3>
                <p className="text-muted-foreground">
                  Compartilhe via WhatsApp, email ou SMS. Cliente escolhe a melhor forma
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center group">
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-brand/30 group-hover:scale-110 transition-transform duration-300">
                    3
                  </div>
                  <div className="absolute -inset-2 bg-brand/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <h3 className="text-xl font-bold mb-3">Receba em 1 Dia</h3>
                <p className="text-muted-foreground">
                  Valor integral creditado em sua conta em 1 dia útil, sem descontos
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Casos de Uso Section */}
        <section id="casos-de-uso" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 tech-dots opacity-20" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Casos de{' '}
                <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
                  uso ideais
                </span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Solução perfeita para diversos segmentos e necessidades
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
              {[
                { icon: FileText, title: "Escritórios de Advocacia", desc: "Negociação de dívidas e acordos judiciais" },
                { icon: Users, title: "Empresas de Cobrança", desc: "Recuperação de crédito com opções atrativas" },
                { icon: Zap, title: "Concessionárias", desc: "Débitos de energia, água e telecomunicações" },
                { icon: HeadphonesIcon, title: "Call Centers", desc: "Fechamento de acordos com confirmação imediata" },
              ].map((item, index) => (
                <div key={index} className="group text-center p-8 rounded-2xl glass-card hover:scale-105 transition-all duration-500">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-accent flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand/20 group-hover:shadow-brand/40 transition-shadow duration-300">
                    <item.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-3">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Depoimentos Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/30 to-background" />
          <div className="absolute inset-0 grid-pattern opacity-20" />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                O que nossos{' '}
                <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
                  clientes dizem
                </span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Resultados comprovados de quem já transformou sua cobrança
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto stagger-children">
              {[
                {
                  quote: "Aumentamos nossa taxa de conversão em 340% no primeiro mês. A facilidade de parcelamento transformou nossa operação.",
                  author: "Ana Silva",
                  role: "Diretora Comercial - Empresa de Cobrança"
                },
                {
                  quote: "Receber em 1 dia útil revolucionou nosso fluxo de caixa. Recomendo para qualquer negócio de cobrança.",
                  author: "Carlos Santos",
                  role: "CEO - Escritório de Advocacia"
                },
                {
                  quote: "Interface intuitiva e suporte excepcional. Conseguimos aumentar a recuperação de crédito em 200%.",
                  author: "Marina Costa",
                  role: "Gerente Financeira - Concessionária"
                }
              ].map((testimonial, index) => (
                <div key={index} className="p-8 rounded-2xl glass-card">
                  <div className="flex items-center gap-1 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-5 w-5 fill-brand text-brand" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6 italic">"{testimonial.quote}"</p>
                  <div>
                    <div className="font-bold">{testimonial.author}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 tech-dots opacity-20" />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Perguntas{' '}
                <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
                  frequentes
                </span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Tire suas dúvidas sobre nossa plataforma
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <Accordion type="single" collapsible className="space-y-4">
                {[
                  {
                    question: "Como funciona o parcelamento em até 21x?",
                    answer: "O cliente pode parcelar o valor da dívida em até 21 vezes no cartão de crédito. Você recebe o valor integral à vista em 1 dia útil, sem descontos ou taxas adicionais."
                  },
                  {
                    question: "Qual o prazo para recebimento?",
                    answer: "O valor é creditado em sua conta em até 1 dia útil após a confirmação do pagamento, independente do número de parcelas escolhido pelo cliente."
                  },
                  {
                    question: "Existe proteção contra chargeback?",
                    answer: "Sim! Nossa plataforma conta com antifraude avançado e proteção total contra chargebacks, garantindo segurança em todas as transações."
                  },
                  {
                    question: "Como gero um link de pagamento?",
                    answer: "Basta acessar o painel, inserir os dados do cliente e o valor, e gerar o link personalizado. O link pode ser enviado via WhatsApp, email ou SMS."
                  },
                  {
                    question: "Quais as formas de pagamento aceitas?",
                    answer: "Aceitamos todas as principais bandeiras de cartão de crédito (Visa, Mastercard, Elo, American Express, entre outras) e PIX."
                  }
                ].map((item, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="rounded-xl glass-card border-none px-6">
                    <AccordionTrigger className="text-left font-semibold hover:no-underline py-6">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-6">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 mesh-gradient" />
          <div className="absolute inset-0 grid-pattern opacity-30" />
          
          {/* Floating orbs */}
          <div className="absolute top-1/4 left-10 w-64 h-64 bg-brand/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-10 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center p-12 rounded-3xl glass-card">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Pronto para{' '}
                <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
                  transformar
                </span>
                {' '}sua cobrança?
              </h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Junte-se a centenas de empresas que já revolucionaram sua gestão de cobranças
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/register">
                  <Button size="lg" className="bg-gradient-to-r from-brand to-accent hover:from-brand-dark hover:to-brand text-white px-10 py-7 text-lg shadow-xl shadow-brand/25 btn-3d shine-effect group">
                    Começar Agora Grátis
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/payment">
                  <Button variant="outline" size="lg" className="px-10 py-7 text-lg border-2 border-brand/30 text-brand hover:bg-brand/5">
                    Testar Demo
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50 relative">
        <div className="absolute inset-0 tech-dots opacity-10" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-3">
              <div className="text-xl font-bold bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
                Autonegocie
              </div>
              <span className="text-muted-foreground">Hub de Pagamentos</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <a href="#recursos" className="hover:text-brand transition-colors">Recursos</a>
              <a href="#como-funciona" className="hover:text-brand transition-colors">Como funciona</a>
              <a href="#faq" className="hover:text-brand transition-colors">FAQ</a>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2024 Autonegocie. Todos os direitos reservados.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
