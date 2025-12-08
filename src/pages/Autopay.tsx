import { useState } from "react";
import { Menu, X, Landmark, Shield, BarChart3, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AutopayLogo from "@/components/autopay/AutopayLogo";
import DeviceMockup from "@/components/autopay/DeviceMockup";
import FeatureCard from "@/components/autopay/FeatureCard";
import FeaturesMockup from "@/components/autopay/FeaturesMockup";
import ChatPromptItem from "@/components/autopay/ChatPromptItem";
import SecurityBadge from "@/components/autopay/SecurityBadge";
import HandDrawnArrow from "@/components/autopay/HandDrawnArrow";
const Autopay = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return <div className="min-h-screen bg-autopay-bg">
      {/* Navbar */}
      <Navbar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      
      {/* Hero Section */}
      <HeroSection />
      
      {/* Features Section */}
      <FeaturesSection />
      
      {/* Autopay Answers Section */}
      <AnswersSection />
      
      {/* Safety Section */}
      <SafetySection />
      
      {/* CTA Section */}
      <CTASection />
      
      {/* Footer */}
      <Footer />
    </div>;
};

// ==================== NAVBAR ====================
const Navbar = ({
  mobileMenuOpen,
  setMobileMenuOpen
}: {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}) => {
  const navLinks = ["Sobre", "Funcionalidades", "Segurança", "Ajuda"];
  return <nav className="sticky top-0 z-50 bg-autopay-bg/95 backdrop-blur-sm border-b border-black/5">
      <div className="max-w-[1120px] mx-auto px-6 h-[72px] flex items-center justify-between">
        <AutopayLogo size="md" />
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map(link => <a key={link} href={`#${link.toLowerCase()}`} className="text-sm font-medium text-autopay-text hover:text-autopay-primary-strong transition-colors">
              {link}
            </a>)}
        </div>
        
        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" className="rounded-full text-autopay-text hover:bg-autopay-text/5">
            Entrar
          </Button>
          <Button className="rounded-full bg-autopay-text text-white hover:bg-autopay-text/90 shadow-autopay-card-soft">
            Criar conta
          </Button>
        </div>
        
        {/* Mobile Menu Button */}
        <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && <div className="md:hidden bg-white border-t border-black/5 p-6 space-y-4">
          {navLinks.map(link => <a key={link} href={`#${link.toLowerCase()}`} className="block text-sm font-medium text-autopay-text py-2" onClick={() => setMobileMenuOpen(false)}>
              {link}
            </a>)}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1 rounded-full">Entrar</Button>
            <Button className="flex-1 rounded-full bg-autopay-text text-white">Criar conta</Button>
          </div>
        </div>}
    </nav>;
};

// ==================== HERO SECTION ====================
const HeroSection = () => {
  return <section className="py-8 px-6">
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
                <Button size="lg" className="rounded-full text-white px-8 py-6 text-base font-semibold shadow-autopay-card hover:-translate-y-0.5 transition-all bg-[#00d678]">
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
    </section>;
};

// ==================== FEATURES SECTION ====================
const FeaturesSection = () => {
  const features = [{
    icon: Landmark,
    title: "Parcelamento Flexível",
    description: "Até 21x no cartão com recebimento integral à vista em 1 dia útil."
  }, {
    icon: Shield,
    title: "Segurança Total",
    description: "Zero chargeback e total proteção contra fraudes."
  }, {
    icon: BarChart3,
    title: "Gestão Inteligente",
    description: "Dashboard completo com relatórios e analytics em tempo real."
  }];
  
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

// ==================== ANSWERS SECTION ====================
const AnswersSection = () => {
  const prompts = ["Como funciona o parcelamento em até 21x?", "Qual o prazo para recebimento?", "Existe proteção contra chargeback?", "Como gero um link de pagamento?", "Quais as formas de pagamento aceitas?"];
  return <section className="py-16 px-6">
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
            
            {/* Prompt Items */}
            <div className="space-y-3">
              {prompts.map((prompt, index) => <ChatPromptItem key={prompt} text={prompt} delay={index * 100} />)}
            </div>
          </div>
        </div>
      </div>
    </section>;
};

// ==================== SAFETY SECTION ====================
const SafetySection = () => {
  const badges = ["Open Finance certificado pelo Banco Central", "Mesma segurança que seu internet banking", "Seus dados nunca saem do Brasil", "Criptografia de ponta a ponta"];
  return <section id="segurança" className="py-16 px-6">
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
              <p className="text-autopay-text/80 leading-relaxed">
                Utilizamos os mais altos padrões de segurança do mercado financeiro, 
                com certificações internacionais e compliance com a LGPD.
              </p>
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
    </section>;
};

// ==================== CTA SECTION ====================
const CTASection = () => {
  return <section className="py-16 px-6">
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
            <Button size="lg" className="rounded-full bg-autopay-text text-white hover:bg-autopay-text/90 px-8 py-6 text-base font-semibold shadow-autopay-card">
              Comece Agora
            </Button>
            <Button size="lg" variant="outline" className="rounded-full border-2 border-autopay-text text-autopay-text hover:bg-autopay-text hover:text-white px-8 py-6 text-base font-semibold">
              Falar com especialista
            </Button>
          </div>
        </div>
      </div>
    </section>;
};

// ==================== FOOTER ====================
const Footer = () => {
  const links = {
    produto: ["Sobre", "Funcionalidades", "Ajuda"],
    legal: ["Política de Privacidade", "Termos e Condições"]
  };
  return <footer className="bg-autopay-surface-dark py-12 px-6">
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
              {links.produto.map(link => <a key={link} href="#" className="block text-white/70 hover:text-white text-sm transition-colors">
                  {link}
                </a>)}
            </div>
          </div>
          
          {/* Legal Links */}
          <div>
            <p className="text-white font-semibold mb-4">Legal</p>
            <div className="space-y-2">
              {links.legal.map(link => <a key={link} href="#" className="block text-white/70 hover:text-white text-sm transition-colors">
                  {link}
                </a>)}
            </div>
          </div>
        </div>
      </div>
    </footer>;
};
export default Autopay;