import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Landmark, Shield, BarChart3, Bot, CheckCircle, FileText, Users, Zap, HeadphonesIcon, Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import AutopayLogo from "@/components/autopay/AutopayLogo";
import { LeadCaptureModal } from "@/components/LeadCaptureModal";
import DeviceMockup from "@/components/autopay/DeviceMockup";
import FeatureCard from "@/components/autopay/FeatureCard";
import FeaturesMockup from "@/components/autopay/FeaturesMockup";
import SecurityBadge from "@/components/autopay/SecurityBadge";
import HandDrawnArrow from "@/components/autopay/HandDrawnArrow";

export default function Index() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  const openLeadModal = () => setLeadModalOpen(true);

  return (
    <div className="min-h-screen bg-autopay-bg">
      {/* SEO Meta Tags */}
      <title>Autonegocie - Hub de Pagamentos | Plataforma Completa de Cobrança</title>
      <meta name="description" content="Hub de Pagamentos Autonegocie - Plataforma completa para gestão de cobranças, parcelamentos flexíveis e recebimento garantido." />

      {/* Navbar */}
      <Navbar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} onOpenLeadModal={openLeadModal} />

      {/* Hero Section */}
      <HeroSection onOpenLeadModal={openLeadModal} />

      {/* Features Section */}
      <FeaturesSection />

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Autopay Answers Section */}
      <AnswersSection />

      {/* Safety Section */}
      <SafetySection />

      {/* Use Cases Section */}
      <UseCasesSection />

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />

      {/* Lead Capture Modal */}
      <LeadCaptureModal open={leadModalOpen} onOpenChange={setLeadModalOpen} />
    </div>
  );
}

// ==================== NAVBAR ====================
const Navbar = ({
  mobileMenuOpen,
  setMobileMenuOpen,
  onOpenLeadModal
}: {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onOpenLeadModal: () => void;
}) => {
  const navLinks = [
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Como funciona", href: "#como-funciona" },
    { label: "Casos de uso", href: "#casos-de-uso" },
    { label: "Segurança", href: "#seguranca" },
    { label: "FAQ", href: "#faq" }
  ];

  return (
    <nav className="sticky top-0 z-50 bg-autopay-bg/95 backdrop-blur-sm border-b border-black/5">
      <div className="max-w-[1120px] mx-auto px-6 h-[72px] flex items-center justify-between">
        <AutopayLogo size="md" />

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map(link => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-autopay-text hover:text-autopay-primary-strong transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" className="rounded-full text-autopay-text hover:bg-autopay-text/5">
              Entrar
            </Button>
          </Link>
          <Button 
            onClick={onOpenLeadModal}
            className="rounded-full bg-autopay-text text-white hover:bg-autopay-text/90 shadow-autopay-card-soft"
          >
            Criar conta
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-black/5 p-6 space-y-4">
          {navLinks.map(link => (
            <a
              key={link.label}
              href={link.href}
              className="block text-sm font-medium text-autopay-text py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="flex gap-3 pt-4">
            <Link to="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full rounded-full">Entrar</Button>
            </Link>
            <Button 
              className="flex-1 w-full rounded-full bg-autopay-text text-white"
              onClick={() => { setMobileMenuOpen(false); onOpenLeadModal(); }}
            >
              Criar conta
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

// ==================== HERO SECTION ====================
const HeroSection = ({ onOpenLeadModal }: { onOpenLeadModal: () => void }) => {
  return (
    <section className="py-8 px-6">
      <div className="max-w-[1120px] mx-auto">
        <div className="rounded-[32px] p-8 md:p-12 lg:p-16 bg-primary-foreground">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column */}
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl font-bold text-autopay-text leading-[1.05] tracking-tight">
                O Jeito Inteligente de Pagar
              </h1>
              <p className="text-lg text-autopay-text/80 max-w-[440px] leading-relaxed">
                Facilitamos pagamentos combinando vários meios em um só fluxo — Vários meios, uma só transação.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <Button 
                  size="lg" 
                  onClick={onOpenLeadModal}
                  className="rounded-full text-white px-8 py-6 text-base font-semibold shadow-autopay-card hover:-translate-y-0.5 transition-all bg-[#00d678]"
                >
                  Comece Agora
                </Button>
                <a href="#funcionalidades" className="text-autopay-text font-medium flex items-center gap-2 hover:gap-3 transition-all py-3">
                  Ver como funciona
                  <span className="text-xl">↓</span>
                </a>
              </div>

              {/* Hand-drawn arrow */}
              <div className="hidden lg:block pt-4">
                <HandDrawnArrow className="text-autopay-text/60 rotate-12 translate-x-20" />
              </div>
            </div>

            {/* Right Column - Device Mockups */}
            <div className="relative flex justify-center lg:justify-end">
              <div className="relative">
                {/* Dark mockup (back) */}
                <DeviceMockup variant="dark" className="absolute -left-8 lg:-left-20 top-8 -rotate-6 z-10" animationDelay={500} />
                {/* Light mockup (front) */}
                <DeviceMockup variant="light" className="relative rotate-3 z-20" animationDelay={0} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==================== FEATURES SECTION ====================
const FeaturesSection = () => {
  const features = [
    {
      icon: Landmark,
      title: "Parcelamento Flexível",
      description: "Até 21x no cartão com recebimento integral à vista em 1 dia útil."
    },
    {
      icon: Shield,
      title: "Segurança Total",
      description: "Zero chargeback e total proteção contra fraudes."
    },
    {
      icon: BarChart3,
      title: "Gestão Inteligente",
      description: "Dashboard completo com relatórios e analytics em tempo real."
    }
  ];

  return (
    <section id="funcionalidades" className="py-16 px-6">
      <div className="max-w-[1120px] mx-auto">
        {/* Título em largura total */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-autopay-text text-center mb-16 tracking-tight leading-[1.1]">
          Ferramentas poderosas para simplificar cobranças e ampliar as possibilidades de pagamento
        </h2>

        {/* Grid 2 colunas */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Coluna Esquerda - Cards empilhados */}
          <div className="space-y-5">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                className="opacity-0 animate-slide-up-stagger"
                style={{ animationDelay: `${index * 100}ms` } as React.CSSProperties}
              />
            ))}
          </div>

          {/* Coluna Direita - Mockups sobrepostos */}
          <div className="relative flex justify-center lg:justify-end">
            <FeaturesMockup />
          </div>
        </div>
      </div>
    </section>
  );
};

// ==================== HOW IT WORKS SECTION ====================
const HowItWorksSection = () => {
  const steps = [
    {
      num: 1,
      title: "Crie seu Link",
      description: "Gere links de pagamento personalizados com suas condições e valores"
    },
    {
      num: 2,
      title: "Envie ao Cliente",
      description: "Compartilhe via WhatsApp, email ou SMS. Cliente escolhe a melhor forma"
    },
    {
      num: 3,
      title: "Receba em 1 Dia",
      description: "Valor integral creditado em sua conta em 1 dia útil, sem descontos"
    }
  ];

  return (
    <section id="como-funciona" className="py-16 px-6 bg-white">
      <div className="max-w-[1120px] mx-auto">
        <div className="rounded-[32px] p-8 md:p-12 lg:p-16 bg-autopay-bg-alt">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-autopay-text mb-4 tracking-tight">
              Como funciona o Hub de Pagamentos
            </h2>
            <p className="text-autopay-text-secondary text-lg max-w-2xl mx-auto">
              Processo simples e eficiente em poucos passos
            </p>
          </div>

          {/* Steps Grid */}
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector Line (desktop only) */}
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-autopay-primary via-autopay-primary-strong to-autopay-primary opacity-30" />

            {steps.map((step, index) => (
              <div key={step.num} className="text-center group">
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-[18px] bg-autopay-primary flex items-center justify-center text-autopay-text text-3xl font-bold shadow-autopay-card group-hover:scale-110 transition-transform duration-300">
                    {step.num}
                  </div>
                  <div className="absolute -inset-2 bg-autopay-primary/20 rounded-[22px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <h3 className="text-xl font-bold text-autopay-text mb-3">{step.title}</h3>
                <p className="text-autopay-text-secondary leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ==================== ANSWERS SECTION (FAQ CHAT) ====================
const AnswersSection = () => {
  const faqItems = [
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
  ];

  return (
    <section id="faq" className="py-16 px-6">
      <div className="max-w-[1120px] mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-autopay-text text-center mb-12">
          Você tem perguntas, a Autopay tem respostas
        </h2>

        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-autopay-card">
            {/* Chat Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-autopay-border">
              <div className="w-10 h-10 rounded-full bg-autopay-primary flex items-center justify-center">
                <Bot className="w-5 h-5 text-autopay-text" />
              </div>
              <div>
                <p className="font-semibold text-autopay-text">Autopay Answers</p>
                <p className="text-xs text-autopay-text-secondary">Assistente virtual</p>
              </div>
            </div>

            {/* Subtitle */}
            <p className="text-sm text-autopay-text-secondary mb-4">Perguntas frequentes</p>

            {/* FAQ Accordion */}
            <Accordion type="single" collapsible className="space-y-3">
              {faqItems.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-autopay-bg-alt rounded-full px-5 border-none data-[state=open]:rounded-[18px]"
                >
                  <AccordionTrigger className="text-left text-sm font-medium text-autopay-text hover:no-underline py-4">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-autopay-text-secondary text-sm pb-4 px-1">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==================== SAFETY SECTION ====================
const SafetySection = () => {
  const badges = [
    "Open Finance certificado pelo Banco Central",
    "Mesma segurança que seu internet banking",
    "Criptografia de ponta a ponta",
    "Proteção total contra chargebacks",
    "Seus dados nunca saem do Brasil"
  ];

  return (
    <section id="seguranca" className="py-16 px-6">
      <div className="max-w-[1120px] mx-auto">
        <div className="bg-gradient-autopay-safety rounded-[32px] p-8 md:p-12 lg:p-16 relative overflow-hidden">
          {/* Noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-noise" />

          <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
            {/* Left Column */}
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-autopay-text mb-4">
                Seus dados estão seguros conosco
              </h2>
              <p className="text-autopay-text/80 leading-relaxed mb-6">
                Utilizamos os mais altos padrões de segurança do mercado financeiro,
                com certificações internacionais e compliance com a LGPD.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-autopay-text/90">
                  <CheckCircle className="w-5 h-5 text-autopay-primary-strong flex-shrink-0" />
                  <span>Antifraude avançado</span>
                </li>
                <li className="flex items-center gap-3 text-autopay-text/90">
                  <CheckCircle className="w-5 h-5 text-autopay-primary-strong flex-shrink-0" />
                  <span>Proteção garantida</span>
                </li>
                <li className="flex items-center gap-3 text-autopay-text/90">
                  <CheckCircle className="w-5 h-5 text-autopay-primary-strong flex-shrink-0" />
                  <span>Dados criptografados</span>
                </li>
              </ul>
            </div>

            {/* Right Column */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-autopay-card-soft">
              <div className="space-y-4">
                {badges.map(badge => <SecurityBadge key={badge} text={badge} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==================== USE CASES SECTION ====================
const UseCasesSection = () => {
  const useCases = [
    {
      icon: FileText,
      title: "Escritórios de Advocacia",
      description: "Negociação de dívidas e acordos judiciais com parcelamento flexível"
    },
    {
      icon: Users,
      title: "Empresas de Cobrança",
      description: "Recuperação de crédito com opções atrativas para o devedor"
    },
    {
      icon: Zap,
      title: "Concessionárias",
      description: "Débitos de energia, água e telecomunicações facilitados"
    },
    {
      icon: HeadphonesIcon,
      title: "Call Centers",
      description: "Fechamento de acordos com confirmação imediata do pagamento"
    }
  ];

  return (
    <section id="casos-de-uso" className="py-16 px-6 bg-white">
      <div className="max-w-[1120px] mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-autopay-text mb-4 tracking-tight">
            Casos de uso ideais
          </h2>
          <p className="text-autopay-text-secondary text-lg max-w-2xl mx-auto">
            Solução perfeita para diversos segmentos e necessidades
          </p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {useCases.map((useCase, index) => (
            <div
              key={useCase.title}
              className="group bg-autopay-bg rounded-[18px] p-6 shadow-autopay-card-soft hover:shadow-autopay-card hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-[14px] bg-autopay-primary/10 flex items-center justify-center mb-5 group-hover:bg-autopay-primary/20 transition-colors">
                <useCase.icon className="w-7 h-7 text-autopay-primary-strong" />
              </div>
              <h3 className="text-lg font-bold text-autopay-text mb-2">{useCase.title}</h3>
              <p className="text-sm text-autopay-text-secondary leading-relaxed">
                {useCase.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==================== TESTIMONIALS SECTION ====================
const TestimonialsSection = () => {
  const testimonials = [
    {
      quote: "Aumentamos nossa taxa de conversão em 340% no primeiro mês. A facilidade de parcelamento transformou nossa operação.",
      author: "Ana Silva",
      role: "Diretora Comercial - Empresa de Cobrança",
      initials: "AS"
    },
    {
      quote: "Receber em 1 dia útil revolucionou nosso fluxo de caixa. Recomendo para qualquer negócio de cobrança.",
      author: "Carlos Santos",
      role: "CEO - Escritório de Advocacia",
      initials: "CS"
    },
    {
      quote: "Interface intuitiva e suporte excepcional. Conseguimos aumentar a recuperação de crédito em 200%.",
      author: "Marina Costa",
      role: "Gerente Financeira - Concessionária",
      initials: "MC"
    }
  ];

  return (
    <section className="py-16 px-6">
      <div className="max-w-[1120px] mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-autopay-text mb-4 tracking-tight">
            O que nossos clientes dizem
          </h2>
          <p className="text-autopay-text-secondary text-lg max-w-2xl mx-auto">
            Resultados comprovados de quem já transformou sua cobrança
          </p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.author}
              className="bg-white rounded-[18px] p-6 shadow-autopay-card-soft hover:shadow-autopay-card transition-shadow duration-300"
            >
              {/* Stars */}
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="h-4 w-4 fill-autopay-primary text-autopay-primary" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-autopay-text-secondary italic mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-autopay-primary/10 flex items-center justify-center text-autopay-primary-strong font-bold text-sm">
                  {testimonial.initials}
                </div>
                <div>
                  <div className="font-bold text-autopay-text text-sm">{testimonial.author}</div>
                  <div className="text-xs text-autopay-text-secondary">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==================== CTA SECTION ====================
const CTASection = () => {
  return (
    <section className="py-16 px-6">
      <div className="max-w-[1120px] mx-auto">
        <div className="bg-autopay-primary rounded-[32px] p-8 md:p-12 lg:p-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-autopay-text mb-4">
            Pronto para transformar sua cobrança?
          </h2>
          <p className="text-autopay-text/80 max-w-2xl mx-auto mb-8 leading-relaxed">
            Junte-se a centenas de empresas que já aumentaram a eficiência e a flexibilidade
            dos seus pagamentos com soluções que combinam múltiplos meios em uma única transação.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="rounded-full bg-autopay-text text-white hover:bg-autopay-text/90 px-8 py-6 text-base font-semibold shadow-autopay-card group">
                Comece Agora
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="rounded-full border-2 border-autopay-text text-autopay-text hover:bg-autopay-text hover:text-white px-8 py-6 text-base font-semibold">
                Falar com especialista
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==================== FOOTER ====================
const Footer = () => {
  const links = {
    produto: [
      { label: "Funcionalidades", href: "#funcionalidades" },
      { label: "Como funciona", href: "#como-funciona" },
      { label: "Segurança", href: "#seguranca" },
      { label: "FAQ", href: "#faq" }
    ],
    legal: [
      { label: "Política de Privacidade", href: "#" },
      { label: "Termos e Condições", href: "#" }
    ]
  };

  return (
    <footer className="bg-autopay-surface-dark py-12 px-6">
      <div className="max-w-[1120px] mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Logo & Copyright */}
          <div>
            <AutopayLogo size="md" variant="light" />
            <p className="text-white/50 text-sm mt-4">
              © {new Date().getFullYear()} Autopay. Todos os direitos reservados.
            </p>
          </div>

          {/* Produto Links */}
          <div>
            <p className="text-white font-semibold mb-4">Produto</p>
            <div className="space-y-2">
              {links.produto.map(link => (
                <a key={link.label} href={link.href} className="block text-white/70 hover:text-white text-sm transition-colors">
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Legal Links */}
          <div>
            <p className="text-white font-semibold mb-4">Legal</p>
            <div className="space-y-2">
              {links.legal.map(link => (
                <a key={link.label} href={link.href} className="block text-white/70 hover:text-white text-sm transition-colors">
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
