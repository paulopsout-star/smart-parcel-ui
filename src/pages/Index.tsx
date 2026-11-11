import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Menu, X, ArrowRight, TrendingUp, ShieldCheck, Activity, Link2, Wallet, BadgeCheck,
  RefreshCcw, MessageSquareText, Building2, GraduationCap, LayoutGrid, Percent, Layers,
  Lock, Rocket, Headphones, Target, Eye, HeartHandshake, CreditCard, QrCode, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadCaptureModal } from "@/components/LeadCaptureModal";

/**
 * Landing page Combinaí — alteração EXCLUSIVAMENTE visual (11/2026).
 * Destinos e comportamentos preservados da página anterior:
 *   - "Entrar" → /login
 *   - "Criar conta", "Começar agora", "Falar com um especialista", "Criar minha conta" → modal de captura de lead
 *   - menu → âncoras das seções desta página; menu mobile com o mesmo estado de antes
 * Paleta: verde principal #00B878, vibrante #00C853, profundo #006B46, suave #E8F8F1, texto #101820, apoio #64748B.
 */

const LOGO = "/combinai-logo.png";
const CONTAINER = "max-w-[1240px] mx-auto px-5 sm:px-8";

export default function Index() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const openLeadModal = () => setLeadModalOpen(true);

  return (
    <div className="min-h-screen bg-white text-[#101820] antialiased overflow-x-hidden">
      <title>Combinaí - Pagamentos mais flexíveis | Cartão ou Cartão + PIX</title>
      <meta name="description" content="A Combinaí transforma negociações em recebimentos realizados: cartão, parcelado ou cartão + PIX, com gestão em tempo real." />

      <Navbar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} onOpenLeadModal={openLeadModal} />
      <HeroSection onOpenLeadModal={openLeadModal} />
      <PositioningSection />
      <HowItWorksSection />
      <SolutionsSection />
      <WhySection />
      <AboutSection onOpenLeadModal={openLeadModal} />
      <FinalCTASection onOpenLeadModal={openLeadModal} />
      <Footer />

      <LeadCaptureModal open={leadModalOpen} onOpenChange={setLeadModalOpen} />
    </div>
  );
}

// ==================== LOGO ====================
function Logo({ className = "h-9" }: { className?: string }) {
  return <img src={LOGO} alt="Combinaí" className={`${className} w-auto select-none`} draggable={false} />;
}

/** Marca em texto para fundo escuro (o arquivo do logotipo tem fundo branco). */
function LogoText({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-end font-extrabold tracking-tight ${className}`} aria-label="Combinaí">
      <span>Combin</span>
      <span className="text-[#00C853]">aí</span>
    </span>
  );
}

// ==================== NAVBAR ====================
const NAV_LINKS = [
  { label: "Soluções", href: "#solucoes" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Para quem é", href: "#para-quem-e" },
  { label: "Sobre nós", href: "#sobre" },
  { label: "Contato", href: "#contato" },
];

const Navbar = ({
  mobileMenuOpen, setMobileMenuOpen, onOpenLeadModal,
}: { mobileMenuOpen: boolean; setMobileMenuOpen: (open: boolean) => void; onOpenLeadModal: () => void }) => (
  <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
    <div className={`${CONTAINER} h-[76px] flex items-center justify-between gap-6`}>
      <a href="#" className="shrink-0" aria-label="Combinaí - início"><Logo className="h-9 sm:h-10" /></a>

      <nav className="hidden lg:flex items-center gap-8" aria-label="Principal">
        {NAV_LINKS.map((link) => (
          <a key={link.label} href={link.href} className="text-[15px] font-medium text-[#101820]/80 hover:text-[#006B46] transition-colors">
            {link.label}
          </a>
        ))}
      </nav>

      <div className="hidden lg:flex items-center gap-3">
        <Link to="/login">
          <Button variant="outline" className="h-11 rounded-full px-6 border-2 border-[#00B878] text-[#006B46] font-semibold hover:bg-[#E8F8F1] hover:text-[#006B46]">
            Entrar
          </Button>
        </Link>
        <Button onClick={onOpenLeadModal} className="h-11 rounded-full px-6 bg-[#00B878] hover:bg-[#00a56c] text-white font-semibold shadow-[0_10px_24px_rgba(0,184,120,0.28)]">
          Criar conta
        </Button>
      </div>

      <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Abrir menu" aria-expanded={mobileMenuOpen}>
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
    </div>

    {mobileMenuOpen && (
      <div className="lg:hidden bg-white border-t border-slate-100 px-5 py-6 space-y-2">
        {NAV_LINKS.map((link) => (
          <a key={link.label} href={link.href} className="block text-[15px] font-medium text-[#101820] py-2.5" onClick={() => setMobileMenuOpen(false)}>
            {link.label}
          </a>
        ))}
        <div className="flex gap-3 pt-4">
          <Link to="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
            <Button variant="outline" className="w-full h-11 rounded-full border-2 border-[#00B878] text-[#006B46] font-semibold">Entrar</Button>
          </Link>
          <Button className="flex-1 w-full h-11 rounded-full bg-[#00B878] text-white font-semibold" onClick={() => { setMobileMenuOpen(false); onOpenLeadModal(); }}>
            Criar conta
          </Button>
        </div>
      </div>
    )}
  </header>
);

// ==================== HERO ====================
const Eyebrow = ({ children, light = false }: { children: React.ReactNode; light?: boolean }) => (
  <p className={`text-xs font-bold tracking-[0.18em] uppercase ${light ? "text-[#9BF0C9]" : "text-[#00B878]"}`}>{children}</p>
);

const HeroSection = ({ onOpenLeadModal }: { onOpenLeadModal: () => void }) => {
  const highlights = [
    { icon: TrendingUp, label: "Mais conversão nos acordos" },
    { icon: ShieldCheck, label: "Pagamento seguro" },
    { icon: Activity, label: "Gestão em tempo real" },
  ];
  return (
    <section className="relative overflow-hidden">
      {/* formas curvas e gradientes ao fundo */}
      <div className="pointer-events-none absolute -top-32 right-[-10%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(0,200,83,0.18),rgba(0,184,120,0)_70%)]" />
      <div className="pointer-events-none absolute bottom-[-220px] right-[12%] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle_at_center,rgba(0,107,70,0.14),rgba(0,107,70,0)_70%)]" />

      <div className={`${CONTAINER} py-14 md:py-20 lg:py-24 grid lg:grid-cols-2 gap-12 lg:gap-10 items-center`}>
        <div className="space-y-7 max-w-[560px]">
          <Eyebrow>Pagamentos mais flexíveis</Eyebrow>
          <h1 className="text-[2.6rem] leading-[1.05] sm:text-5xl lg:text-[3.75rem] font-extrabold tracking-tight">
            Cartão ou<br />Cartão + <span className="text-[#00B878]">PIX.</span>
          </h1>
          <p className="text-lg text-[#64748B] leading-relaxed max-w-[480px]">
            A solução de pagamentos que transforma negociações em recebimentos realizados.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button size="lg" onClick={onOpenLeadModal} className="h-13 rounded-full px-8 py-6 text-base font-semibold bg-[#00B878] hover:bg-[#00a56c] text-white shadow-[0_14px_30px_rgba(0,184,120,0.30)] hover:-translate-y-0.5 transition-all">
              Começar agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={onOpenLeadModal} className="rounded-full px-8 py-6 text-base font-semibold border-2 border-[#101820]/15 text-[#101820] hover:bg-[#E8F8F1] hover:border-[#00B878] hover:text-[#006B46]">
              Falar com um especialista
            </Button>
          </div>
          <ul className="grid sm:grid-cols-3 gap-4 pt-2">
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm font-medium text-[#101820]">
                <span className="h-9 w-9 shrink-0 rounded-full bg-[#E8F8F1] text-[#006B46] flex items-center justify-center"><Icon className="h-4.5 w-4.5" /></span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <PhoneShowcase />
      </div>
    </section>
  );
};

/** Smartphone ilustrativo com a tela de pagamento da Combinaí (apenas demonstração visual). */
const PhoneShowcase = () => (
  <div className="relative mx-auto w-full max-w-[460px] h-[520px] sm:h-[600px] flex items-center justify-center" aria-hidden>
    {/* curvas de fundo */}
    <div className="absolute inset-x-6 top-10 bottom-6 rounded-[48px] bg-gradient-to-br from-[#E8F8F1] via-[#d6f5e6] to-[#b9efd6]" />
    <div className="absolute -right-6 top-20 h-56 w-56 rounded-full bg-gradient-to-br from-[#00C853] to-[#00B878] opacity-25 blur-2xl" />

    {/* smartphone */}
    <div className="relative z-10 w-[250px] sm:w-[280px] rounded-[38px] bg-[#101820] p-2.5 shadow-[0_40px_80px_rgba(16,24,32,0.35)] rotate-[-6deg] translate-x-2">
      <div className="rounded-[30px] bg-white overflow-hidden">
        <div className="h-7 flex items-center justify-center"><span className="h-1.5 w-16 rounded-full bg-[#101820]/15" /></div>
        <div className="px-5 pb-6 space-y-4">
          <LogoText className="text-xl" />
          <div>
            <p className="text-[11px] text-[#64748B]">Total do acordo</p>
            <p className="text-2xl font-extrabold">R$ 1.240,00</p>
          </div>
          <p className="text-xs font-semibold text-[#101820]">Como você prefere pagar?</p>
          <div className="rounded-2xl border-2 border-[#00B878] bg-[#E8F8F1] p-3 flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-white text-[#006B46] flex items-center justify-center"><CreditCard className="h-4.5 w-4.5" /></span>
            <div className="flex-1">
              <p className="text-sm font-semibold">Cartão de crédito</p>
              <p className="text-[11px] text-[#64748B]">à vista ou parcelado</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-[#00B878]" />
          </div>
          <div className="rounded-2xl border border-slate-200 p-3 flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-[#E8F8F1] text-[#006B46] flex items-center justify-center"><QrCode className="h-4.5 w-4.5" /></span>
            <div className="flex-1">
              <p className="text-sm font-semibold">Cartão + PIX</p>
              <p className="text-[11px] text-[#64748B]">uma parte agora, o resto no cartão</p>
            </div>
            <span className="h-5 w-5 rounded-full border-2 border-slate-300" />
          </div>
          <div className="h-11 rounded-full bg-[#00B878] text-white text-sm font-semibold flex items-center justify-center">Continuar</div>
        </div>
      </div>
    </div>

    {/* cartões flutuantes */}
    <div className="absolute z-20 left-2 sm:left-0 top-14 w-[150px] rounded-2xl bg-white p-3.5 shadow-[0_18px_40px_rgba(16,24,32,0.14)] rotate-[-8deg]">
      <p className="text-[10px] text-[#64748B]">PIX confirmado</p>
      <p className="text-base font-extrabold text-[#006B46]">R$ 240,00</p>
      <div className="mt-2 h-1.5 w-full rounded-full bg-[#E8F8F1]"><div className="h-1.5 w-full rounded-full bg-[#00C853]" /></div>
    </div>
    <div className="absolute z-20 right-0 sm:-right-2 bottom-16 w-[170px] rounded-2xl bg-gradient-to-br from-[#006B46] to-[#00B878] p-3.5 text-white shadow-[0_18px_40px_rgba(0,107,70,0.35)] rotate-[7deg]">
      <div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider opacity-80">Cartão</span><Wallet className="h-4 w-4 opacity-90" /></div>
      <p className="mt-3 text-sm font-semibold tracking-widest">•••• 4921</p>
      <p className="mt-1 text-[10px] opacity-80">12x de R$ 83,33 · sem juros</p>
    </div>
  </div>
);

// ==================== POSICIONAMENTO ====================
const PositioningSection = () => (
  <section className={`${CONTAINER} pb-6`}>
    <div className="rounded-[28px] bg-[#E8F8F1] px-7 py-8 md:px-12 md:py-10 grid md:grid-cols-2 gap-6 md:gap-10 items-center">
      <h2 className="text-2xl md:text-3xl font-extrabold leading-tight tracking-tight">
        O acordo foi feito.<br />A Combinaí ajuda a<br />transformar em pagamento.
      </h2>
      <p className="md:border-l md:border-[#00B878]/30 md:pl-10 text-lg text-[#101820]/75 leading-relaxed">
        Mais flexibilidade para o cliente pagar e mais segurança para a sua empresa receber.
      </p>
    </div>
  </section>
);

// ==================== COMO FUNCIONA ====================
const SectionHeading = ({ eyebrow, title, light = false, align = "center" }: { eyebrow: string; title: React.ReactNode; light?: boolean; align?: "center" | "left" }) => (
  <div className={`space-y-3 ${align === "center" ? "text-center max-w-2xl mx-auto" : ""}`}>
    <Eyebrow light={light}>{eyebrow}</Eyebrow>
    <h2 className={`text-3xl md:text-4xl font-extrabold tracking-tight leading-tight ${light ? "text-white" : ""}`}>{title}</h2>
  </div>
);

const HowItWorksSection = () => {
  const steps = [
    { icon: Link2, title: "Gere o link", text: "Informe o valor e as condições do acordo." },
    { icon: Wallet, title: "Cliente escolhe como pagar", text: "Cartão, à vista, parcelado ou cartão + PIX." },
    { icon: BadgeCheck, title: "Receba com segurança", text: "Acompanhe a confirmação e o recebimento em tempo real." },
  ];
  return (
    <section id="como-funciona" className={`${CONTAINER} py-16 md:py-24 scroll-mt-24`}>
      <SectionHeading eyebrow="Como funciona" title="Simples, rápido e eficiente." />
      <ol className="mt-12 grid md:grid-cols-3 gap-5 md:gap-6 relative">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="relative rounded-[24px] bg-[#E8F8F1]/70 border border-[#00B878]/10 p-7 space-y-4">
            <div className="flex items-center justify-between">
              <span className="h-12 w-12 rounded-2xl bg-white text-[#006B46] flex items-center justify-center shadow-sm"><Icon className="h-5.5 w-5.5" /></span>
              <span className="h-9 w-9 rounded-full bg-[#00B878] text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
            </div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-[#64748B] leading-relaxed">{text}</p>
            {i < steps.length - 1 && (
              <ArrowRight className="hidden md:block absolute -right-5 top-1/2 -translate-y-1/2 h-6 w-6 text-[#00B878] z-10" />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
};

// ==================== SOLUÇÕES ====================
const SolutionsSection = () => {
  const cards = [
    { icon: RefreshCcw, title: "Recuperação de crédito", text: "Aumente a quitação de acordos e recupere recebíveis com mais flexibilidade.", featured: true },
    { icon: MessageSquareText, title: "Cobrança e negociação", text: "Envie links personalizados e aumente a taxa de pagamento." },
    { icon: Building2, title: "Financeiras e credores", text: "Mais opções de pagamento para regularização de contratos." },
    { icon: GraduationCap, title: "Educação e serviços", text: "Recebimentos mais simples e com menos inadimplência." },
    { icon: LayoutGrid, title: "Outros segmentos", text: "Uma solução flexível para diferentes modelos de negócio." },
  ];
  return (
    <section id="solucoes" className="bg-[#F8FAFC] scroll-mt-24">
      <div id="para-quem-e" className={`${CONTAINER} py-16 md:py-24 scroll-mt-24`}>
        <SectionHeading eyebrow="Soluções para sua operação" title="Mais conversão em diferentes cenários." />
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {cards.map(({ icon: Icon, title, text, featured }) => (
            <article
              key={title}
              className={`rounded-[24px] p-6 flex flex-col gap-4 min-h-[240px] ${
                featured
                  ? "bg-gradient-to-br from-[#006B46] to-[#00895a] text-white shadow-[0_24px_50px_rgba(0,107,70,0.28)]"
                  : "bg-white border border-slate-200/80 shadow-[0_10px_30px_rgba(16,24,32,0.05)]"
              }`}
            >
              <span className={`h-12 w-12 rounded-2xl flex items-center justify-center ${featured ? "bg-white/15 text-white" : "bg-[#E8F8F1] text-[#006B46]"}`}>
                <Icon className="h-5.5 w-5.5" />
              </span>
              <h3 className="text-lg font-bold leading-snug">{title}</h3>
              <p className={`text-sm leading-relaxed ${featured ? "text-white/85" : "text-[#64748B]"}`}>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==================== POR QUE ESCOLHER ====================
const WhySection = () => {
  const benefits = [
    { icon: Percent, label: "Maior taxa de conversão" },
    { icon: Layers, label: "Mais opções de pagamento" },
    { icon: Lock, label: "Segurança e confiabilidade" },
    { icon: Rocket, label: "Implantação rápida" },
    { icon: Headphones, label: "Suporte especializado" },
  ];
  return (
    <section className={`${CONTAINER} py-10 md:py-14`}>
      <div className="rounded-[32px] bg-gradient-to-r from-[#005238] via-[#006B46] to-[#00895a] px-7 py-10 md:px-12 md:py-14 grid lg:grid-cols-[1fr_1.4fr] gap-10 items-center text-white relative overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <SectionHeading eyebrow="Por que escolher a Combinaí?" title={<>Mais resultados<br />para a sua operação.</>} light align="left" />
        <ul className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {benefits.map(({ icon: Icon, label }) => (
            <li key={label} className="rounded-2xl bg-white/10 border border-white/15 p-4 flex xl:flex-col items-center xl:items-start gap-3">
              <span className="h-10 w-10 shrink-0 rounded-xl bg-white text-[#006B46] flex items-center justify-center"><Icon className="h-5 w-5" /></span>
              <span className="text-sm font-semibold leading-snug">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

// ==================== SOBRE ====================
const AboutSection = ({ onOpenLeadModal }: { onOpenLeadModal: () => void }) => {
  const pillars = [
    { icon: Target, title: "Missão", text: "Facilitar pagamentos e ampliar oportunidades de recebimento com tecnologia, flexibilidade e segurança." },
    { icon: Eye, title: "Visão", text: "Ser referência nacional em soluções inteligentes e flexíveis de pagamento." },
    { icon: HeartHandshake, title: "Valores", text: "Pessoas em primeiro lugar, flexibilidade, inovação, segurança, simplicidade, transparência e resultados compartilhados." },
  ];
  return (
    <section id="sobre" className={`${CONTAINER} py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center scroll-mt-24`}>
      <div className="space-y-6 max-w-[520px]">
        <Eyebrow>Sobre a Combinaí</Eyebrow>
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">Tecnologia, flexibilidade<br />e propósito.</h2>
        <p className="text-lg text-[#64748B] leading-relaxed">
          A Combinaí é uma empresa de tecnologia em pagamentos que conecta pessoas e empresas por meio de soluções simples, seguras e inteligentes.
        </p>
        {/* Botão sem destino próprio na aplicação atual: leva ao mesmo contato (modal de lead) */}
        <Button onClick={onOpenLeadModal} variant="outline" className="h-12 rounded-full px-7 border-2 border-[#00B878] text-[#006B46] font-semibold hover:bg-[#E8F8F1] hover:text-[#006B46]">
          Conheça nossa história
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-4">
        {pillars.map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-[22px] bg-[#F8FAFC] border border-slate-200/70 p-5 md:p-6 flex gap-4">
            <span className="h-12 w-12 shrink-0 rounded-2xl bg-[#E8F8F1] text-[#006B46] flex items-center justify-center"><Icon className="h-5.5 w-5.5" /></span>
            <div>
              <h3 className="font-bold text-lg">{title}</h3>
              <p className="text-[#64748B] leading-relaxed mt-1">{text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

// ==================== CTA FINAL ====================
const FinalCTASection = ({ onOpenLeadModal }: { onOpenLeadModal: () => void }) => (
  <section id="contato" className={`${CONTAINER} pb-16 md:pb-24 scroll-mt-24`}>
    <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#006B46] via-[#007a4f] to-[#00B878] px-7 py-12 md:px-14 md:py-16 text-white grid lg:grid-cols-[1.3fr_1fr] gap-8 items-center">
      <div className="pointer-events-none absolute -left-24 -bottom-32 h-80 w-80 rounded-full border-[28px] border-white/10" />
      <div className="pointer-events-none absolute right-10 -top-28 h-64 w-64 rounded-full bg-white/10" />
      <div className="relative space-y-4">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Vamos conversar?</h2>
        <p className="text-white/85 text-lg leading-relaxed max-w-[560px]">
          Descubra como a Combinaí pode aumentar a conversão dos seus acordos e reduzir a inadimplência.
        </p>
      </div>
      <div className="relative flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-stretch">
        <Button size="lg" onClick={onOpenLeadModal} className="rounded-full px-8 py-6 text-base font-semibold bg-white text-[#006B46] hover:bg-[#E8F8F1]">
          Falar com um especialista
        </Button>
        <Button size="lg" variant="outline" onClick={onOpenLeadModal} className="rounded-full px-8 py-6 text-base font-semibold border-2 border-white/70 bg-transparent text-white hover:bg-white/10 hover:text-white">
          Criar minha conta
        </Button>
      </div>
    </div>
  </section>
);

// ==================== FOOTER ====================
const Footer = () => {
  const links = {
    produto: [
      { label: "Soluções", href: "#solucoes" },
      { label: "Como funciona", href: "#como-funciona" },
      { label: "Para quem é", href: "#para-quem-e" },
      { label: "Sobre nós", href: "#sobre" },
    ],
    legal: [
      { label: "Política de Privacidade", href: "#" },
      { label: "Termos e Condições", href: "#" },
    ],
  };
  return (
    <footer className="bg-[#101820] py-12">
      <div className={`${CONTAINER} grid md:grid-cols-3 gap-8`}>
        <div>
          <LogoText className="text-2xl text-white" />
          <p className="text-white/50 text-sm mt-4">© {new Date().getFullYear()} Combinaí. Todos os direitos reservados.</p>
        </div>
        <div>
          <p className="text-white font-semibold mb-4">Produto</p>
          <div className="space-y-2">
            {links.produto.map((link) => (
              <a key={link.label} href={link.href} className="block text-white/70 hover:text-white text-sm transition-colors">{link.label}</a>
            ))}
          </div>
        </div>
        <div>
          <p className="text-white font-semibold mb-4">Legal</p>
          <div className="space-y-2">
            {links.legal.map((link) => (
              <a key={link.label} href={link.href} className="block text-white/70 hover:text-white text-sm transition-colors">{link.label}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
