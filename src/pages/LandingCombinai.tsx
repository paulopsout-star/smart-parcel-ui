import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Menu, X, ArrowRight, ChevronDown, Headphones, TrendingUp, ShieldCheck, Activity, Zap,
  Link2, CreditCard, CheckCircle2, RefreshCcw, FileCheck2, Landmark, GraduationCap, Building2,
  ChartNoAxesCombined, WalletCards, Headset, Target, Eye, Gem, QrCode, Lock, BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadCaptureModal } from "@/components/LeadCaptureModal";

/**
 * Landing page Combinaí — em ROTA SECUNDÁRIA (/combinai) enquanto a raiz continua com a página atual.
 * Não indexada e sem links no app. Na troca, a rota "/" passa a renderizar este componente.
 *
 * Referência: kit visual (layout_aprovado.png). Alteração exclusivamente visual.
 * Mapa de CTAs, preservado da página pública atual:
 *   - "Entrar" → /login
 *   - "Criar conta", "Começar agora", "Falar com um especialista", "Criar minha conta" → modal de captura de lead
 *   - "Conheça nossa história" → não existe destino no app: abre o mesmo modal de contato (ponto pendente)
 *   - menu → âncoras das seções desta página; menu mobile com o mesmo estado de antes
 *   - cards de "Soluções" não têm destino no app: a seta é decorativa, sem link
 * Assets: /combinai-logo.png (oficial, sem fundo); /landing/foto-contextual.png é recorte PROVISÓRIO da
 * referência e deve ser substituído por imagem licenciada antes da troca para a raiz.
 */

const LOGO = "/combinai-logo.png";
const FOTO = "/landing/foto-contextual.png";
const CONTAINER = "max-w-[1240px] mx-auto px-5 sm:px-8";
const DARK = "#003D2B";

export default function LandingCombinai() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const openLeadModal = () => setLeadModalOpen(true);

  // Rota de transição: não deixar buscadores indexarem
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#101820] antialiased overflow-x-hidden">
      <title>Combinaí - Mais acordos pagos. Menos oportunidades perdidas.</title>
      <meta name="description" content="A solução de pagamentos que combina cartão e PIX e transforma negociações em recebimentos realizados." />

      <Navbar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} onOpenLeadModal={openLeadModal} />
      <HeroSection onOpenLeadModal={openLeadModal} />
      <ProblemSection />
      <HowItWorksSection />
      <SolutionsSection />
      <BenefitsSection />
      <AboutSection onOpenLeadModal={openLeadModal} />
      <FinalCTASection onOpenLeadModal={openLeadModal} />
      <Footer />

      <LeadCaptureModal open={leadModalOpen} onOpenChange={setLeadModalOpen} />
    </div>
  );
}

// ==================== LOGO ====================
function Logo({ className = "h-9" }: { className?: string }) {
  return <img src={LOGO} alt="Combinaí" width={720} height={239} className={`${className} w-auto select-none`} draggable={false} />;
}

// ==================== HEADER ====================
const NAV_LINKS = [
  { label: "Soluções", href: "#solucoes", caret: true },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Para quem é", href: "#para-quem-e" },
  { label: "Sobre nós", href: "#sobre" },
  { label: "Contato", href: "#contato" },
];

const Eyebrow = ({ children, light = false, className = "" }: { children: React.ReactNode; light?: boolean; className?: string }) => (
  <p className={`text-[11px] sm:text-xs font-bold tracking-[0.2em] uppercase ${light ? "text-[#7CF2B8]" : "text-[#0E8A5F]"} ${className}`}>{children}</p>
);

const Navbar = ({
  mobileMenuOpen, setMobileMenuOpen, onOpenLeadModal,
}: { mobileMenuOpen: boolean; setMobileMenuOpen: (open: boolean) => void; onOpenLeadModal: () => void }) => (
  <header id="topo" className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm">
    <div className={`${CONTAINER} h-[72px] flex items-center justify-between gap-6`}>
      <a href="#topo" className="shrink-0 flex items-center" aria-label="Combinaí - início"><Logo className="h-10 sm:h-11 lg:h-12" /></a>

      <nav className="hidden lg:flex items-center gap-7" aria-label="Principal">
        {NAV_LINKS.map((link) => (
          <a key={link.label} href={link.href} className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#101820] hover:text-[#0E8A5F] transition-colors">
            {link.label}
            {link.caret && <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
          </a>
        ))}
      </nav>

      <div className="hidden lg:flex items-center gap-3">
        <Link to="/login">
          <Button variant="outline" className="h-10 rounded-full px-6 border-[1.5px] border-[#0E8A5F] text-[#0E8A5F] font-semibold bg-white hover:bg-[#F1FBF6] hover:text-[#0E8A5F]">
            Entrar
          </Button>
        </Link>
        <Button onClick={onOpenLeadModal} className="h-10 rounded-full px-5 bg-[#1DB954] hover:bg-[#17a94a] text-white font-semibold">
          Criar conta
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>

      <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Abrir menu" aria-expanded={mobileMenuOpen}>
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
    </div>

    {mobileMenuOpen && (
      <div className="lg:hidden bg-white border-t border-slate-100 px-5 py-6 space-y-2">
        {NAV_LINKS.map((link) => (
          <a key={link.label} href={link.href} className="block text-[15px] font-semibold text-[#101820] py-2.5" onClick={() => setMobileMenuOpen(false)}>
            {link.label}
          </a>
        ))}
        <div className="flex gap-3 pt-4">
          <Link to="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
            <Button variant="outline" className="w-full h-11 rounded-full border-[1.5px] border-[#0E8A5F] text-[#0E8A5F] font-semibold">Entrar</Button>
          </Link>
          <Button className="flex-1 w-full h-11 rounded-full bg-[#1DB954] text-white font-semibold" onClick={() => { setMobileMenuOpen(false); onOpenLeadModal(); }}>
            Criar conta
          </Button>
        </div>
      </div>
    )}
  </header>
);

// ==================== HERO ====================
const HeroSection = ({ onOpenLeadModal }: { onOpenLeadModal: () => void }) => {
  const highlights = [
    { icon: TrendingUp, label: <>Mais conversão<br className="hidden sm:block" /> nos acordos</> },
    { icon: ShieldCheck, label: <>Pagamento<br className="hidden sm:block" /> seguro</> },
    { icon: Activity, label: <>Gestão<br className="hidden sm:block" /> em tempo real</> },
  ];
  return (
    <section className="relative overflow-hidden">
      <div className={`${CONTAINER} pt-4 pb-6 md:pt-8 md:pb-10 lg:pt-10 grid lg:grid-cols-[1.15fr_0.95fr] gap-8 lg:gap-4 items-center`}>
        <div className="space-y-5 max-w-[660px]">
          <Eyebrow>Pagamentos mais flexíveis</Eyebrow>
          <h1 className="text-[2.35rem] leading-[1.04] sm:text-[3rem] lg:text-[3.35rem] xl:text-[3.6rem] font-extrabold tracking-[-0.02em] [text-wrap:balance]">
            Mais acordos pagos.<br />
            <span className="text-[#1DB954]">Menos oportunidades perdidas.</span>
          </h1>
          <p className="text-[17px] md:text-lg text-[#3B4652] leading-relaxed max-w-[540px]">
            A solução de pagamentos que combina Cartão e PIX e transforma negociações em recebimentos realizados.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-1">
            <Button size="lg" onClick={onOpenLeadModal} className="h-12 rounded-full px-7 text-[15px] font-semibold text-white border-0" style={{ background: `linear-gradient(90deg, ${DARK} 0%, #0B6B4A 100%)` }}>
              Começar agora
              <ArrowRight className="ml-2 h-4.5 w-4.5" />
            </Button>
            <Button size="lg" variant="outline" onClick={onOpenLeadModal} className="h-12 rounded-full px-6 text-[15px] font-semibold border-[1.5px] border-[#1DB954] text-[#101820] bg-white hover:bg-[#F1FBF6] hover:text-[#101820]">
              <Headphones className="mr-2 h-4.5 w-4.5 text-[#0E8A5F]" />
              Falar com um especialista
            </Button>
          </div>
          <ul className="flex flex-wrap items-center gap-y-3 pt-4 text-[15px] font-semibold text-[#101820]">
            {highlights.map(({ icon: Icon, label }, i) => (
              <li key={i} className={`flex items-center gap-2.5 pr-5 lg:pr-7 ${i > 0 ? "sm:pl-5 lg:pl-7 sm:border-l sm:border-slate-200" : ""}`}>
                <Icon className="h-6 w-6 shrink-0 text-[#0E8A5F]" strokeWidth={1.6} aria-hidden />
                <span className="leading-tight">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <PhoneShowcase />
      </div>
    </section>
  );
};

/** Smartphone ilustrativo com a tela de checkout da Combinaí. Só demonstração visual; não é o checkout real. */
const PhoneShowcase = () => (
  <div className="relative mx-auto w-full max-w-[440px] h-[440px] sm:h-[520px] lg:h-[560px] flex items-center justify-center" aria-hidden>
    {/* fundo verde discreto, sempre dentro da coluna */}
    <div className="absolute inset-x-[10%] inset-y-[8%] rounded-[44%_56%_42%_58%/56%_44%_56%_44%] bg-gradient-to-br from-[#1DB954] via-[#15A75A] to-[#0B5A3F] opacity-90" />

    {/* elemento flutuante: notificação de PIX confirmado (interface real, discreta) */}
    <div className="absolute z-20 left-[2%] sm:left-[4%] top-[12%] w-[150px] sm:w-[168px] rounded-xl bg-white/95 border border-slate-200 shadow-[0_8px_24px_rgba(16,24,32,0.10)] p-3 flex items-center gap-2.5">
      <span className="h-8 w-8 shrink-0 rounded-lg bg-[#E9F8F0] text-[#0E8A5F] flex items-center justify-center"><BellRing className="h-4 w-4" strokeWidth={1.6} /></span>
      <div className="min-w-0">
        <p className="text-[10px] text-[#64748B] leading-tight">PIX confirmado</p>
        <p className="text-[12px] font-bold leading-tight">R$ 320,00</p>
      </div>
    </div>
    {/* elemento flutuante: resumo do parcelamento */}
    <div className="absolute z-20 right-[2%] sm:right-[3%] bottom-[14%] w-[150px] sm:w-[168px] rounded-xl bg-white/95 border border-slate-200 shadow-[0_8px_24px_rgba(16,24,32,0.10)] p-3">
      <div className="flex items-center justify-between text-[10px] text-[#64748B]"><span>Cartão · 12x</span><CreditCard className="h-3.5 w-3.5 text-[#0E8A5F]" strokeWidth={1.6} /></div>
      <p className="mt-1 text-[12px] font-bold leading-tight">12x de R$ 80,00</p>
      <div className="mt-2 h-1 w-full rounded-full bg-slate-100"><div className="h-1 w-3/4 rounded-full bg-[#1DB954]" /></div>
    </div>

    {/* smartphone */}
    <div className="relative z-10 w-[208px] sm:w-[236px] lg:w-[244px] rounded-[38px] bg-[#0f1a16] p-[8px] shadow-[0_24px_48px_rgba(16,24,32,0.22)] rotate-[-6deg]">
      <div className="rounded-[32px] bg-white overflow-hidden">
        <div className="relative h-8 flex items-center justify-between px-5 text-[10px] font-semibold">
          <span>9:41</span>
          <span className="absolute left-1/2 -translate-x-1/2 top-2 h-4 w-16 rounded-full bg-[#0f1a16]" />
          <span className="flex gap-[3px] items-end" aria-hidden>
            <span className="h-1.5 w-[3px] bg-[#101820] rounded-sm" /><span className="h-2 w-[3px] bg-[#101820] rounded-sm" /><span className="h-2.5 w-[3px] bg-[#101820] rounded-sm" />
          </span>
        </div>
        <div className="px-4 pb-5 pt-1.5 space-y-3.5">
          <div className="flex justify-center"><Logo className="h-5" /></div>
          <p className="text-center text-[17px] font-extrabold tracking-tight">Pague do seu jeito</p>
          <div className="text-center">
            <p className="text-[10px] text-[#64748B]">Valor do acordo</p>
            <p className="text-[20px] font-extrabold tracking-tight">R$ 1.280,00</p>
          </div>
          <div className="rounded-xl border-[1.5px] border-[#1DB954] bg-[#F1FBF6] p-2.5 flex items-center gap-2.5">
            <span className="h-4 w-4 rounded-full border-[4px] border-[#1DB954] bg-white shrink-0" />
            <CreditCard className="h-5 w-5 text-[#0E8A5F] shrink-0" strokeWidth={1.6} />
            <div>
              <p className="text-[12px] font-bold leading-tight">Cartão de crédito</p>
              <p className="text-[9.5px] text-[#64748B]">Pague à vista ou em até 12x</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-2.5 flex items-center gap-2.5">
            <span className="h-4 w-4 rounded-full border-2 border-slate-300 shrink-0" />
            <span className="relative shrink-0">
              <CreditCard className="h-5 w-5 text-[#0E8A5F]" strokeWidth={1.6} />
              <QrCode className="absolute -right-1.5 -bottom-1 h-3 w-3 text-[#1DB954] bg-white rounded-sm" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[12px] font-bold leading-tight">Cartão + PIX</p>
              <p className="text-[9.5px] text-[#64748B]">Divida o pagamento entre cartão e PIX</p>
            </div>
          </div>
          <div className="h-10 rounded-full text-white text-[12px] font-semibold flex items-center justify-center gap-1.5" style={{ background: `linear-gradient(90deg, #1DB954 0%, #0E8A5F 100%)` }}>
            Continuar pagamento <ArrowRight className="h-3.5 w-3.5" />
          </div>
          <p className="flex items-center justify-center gap-1 text-[9.5px] text-[#64748B]"><Lock className="h-3 w-3" strokeWidth={1.6} /> Pagamento seguro e criptografado</p>
        </div>
      </div>
    </div>
  </div>
);

// ==================== PROBLEMA E RESPOSTA ====================
const ProblemSection = () => (
  <section className="relative">
    <div className={`${CONTAINER} py-8 md:py-12 grid md:grid-cols-[280px_1fr] lg:grid-cols-[300px_1fr_1fr] gap-7 lg:gap-8 items-center`}>
      {/* foto contextual com recorte orgânico — asset PROVISÓRIO (ver cabeçalho do arquivo) */}
      <figure className="relative mx-auto md:mx-0 w-[280px] sm:w-[300px] md:w-full max-w-[320px]">
        <div className="absolute -inset-2 rounded-[40px_120px_40px_120px/60px_60px_60px_60px] bg-gradient-to-br from-[#1DB954] to-[#0E8A5F] opacity-90" />
        <img
          src={FOTO}
          alt="Cliente sorrindo enquanto confirma um pagamento pelo celular"
          width={294}
          height={194}
          className="relative w-full h-auto rounded-[36px_110px_36px_110px/54px_54px_54px_54px] object-cover"
          loading="lazy"
        />
      </figure>
      <div className="space-y-3 lg:pr-6">
        <h2 className="text-[1.7rem] md:text-[1.9rem] font-extrabold tracking-tight leading-tight [text-wrap:balance]">Nem todo acordo fechado vira pagamento.</h2>
        <p className="text-[15.5px] text-[#3B4652] leading-[1.65] max-w-[440px]">
          Muitas negociações não se concretizam porque o cliente não encontra uma forma de pagamento que se encaixe na sua realidade.
        </p>
      </div>
      <div className="space-y-3 lg:border-l lg:border-slate-200 lg:pl-8 md:col-span-2 lg:col-span-1">
        <h2 className="text-[1.7rem] md:text-[1.9rem] font-extrabold tracking-tight leading-tight text-[#0E8A5F] [text-wrap:balance]">A Combinaí resolve esse desafio.</h2>
        <p className="text-[15.5px] text-[#3B4652] leading-[1.65] max-w-[400px]">
          Mais flexibilidade para o cliente pagar e mais segurança para a sua empresa receber.
        </p>
      </div>
    </div>
  </section>
);

// ==================== COMO FUNCIONA ====================
const HowItWorksSection = () => {
  const steps = [
    { icon: Link2, title: "Gere o link", text: "Informe o valor e as condições do acordo." },
    { icon: CreditCard, title: "Cliente escolhe como pagar", text: "Cartão, à vista, parcelado ou cartão + PIX." },
    { icon: CheckCircle2, title: "Receba com segurança", text: "Acompanhe a confirmação e o recebimento em tempo real." },
  ];
  return (
    <section id="como-funciona" className={`${CONTAINER} py-8 md:py-14 scroll-mt-24`}>
      <div className="text-center space-y-2">
        <Eyebrow>Como funciona</Eyebrow>
        <h2 className="text-3xl md:text-[2.4rem] font-extrabold tracking-tight">Simples, rápido e eficiente.</h2>
      </div>
      <ol className="mt-9 grid md:grid-cols-[1fr_28px_1fr_28px_1fr] gap-6 md:gap-3 items-center">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="contents">
            <div className="flex items-start gap-4 md:px-1">
              <div className="relative shrink-0">
                <span className="h-[76px] w-[76px] rounded-[22px] bg-[#E9F8F0] text-[#0E8A5F] flex items-center justify-center"><Icon className="h-7 w-7" strokeWidth={1.6} /></span>
                <span className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-[#0E8A5F] text-white text-[12px] font-bold flex items-center justify-center ring-[3px] ring-white">{i + 1}</span>
              </div>
              <div className="pt-1.5">
                <h3 className="text-[17px] font-bold leading-snug">{title}</h3>
                <p className="text-[15px] text-[#3B4652] leading-[1.6] mt-1.5">{text}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="hidden md:block h-6 w-6 text-[#0E8A5F] justify-self-center self-center" aria-hidden />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
};

// ==================== SOLUÇÕES (seção escura) ====================
const SolutionsSection = () => {
  const cards = [
    { icon: RefreshCcw, title: "Recuperação de crédito", featured: true },
    { icon: FileCheck2, title: "Cobrança e negociação" },
    { icon: Landmark, title: "Financeiras e credores" },
    { icon: GraduationCap, title: "Educação e serviços" },
    { icon: Building2, title: "Outros segmentos" },
  ];
  return (
    <section id="solucoes" className="relative overflow-hidden scroll-mt-24" style={{ background: `linear-gradient(100deg, ${DARK} 0%, #0B5A3F 60%, #0E6B46 100%)` }}>
      {/* textura desfocada de apoio, sem comprometer a leitura */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-30 bg-[radial-gradient(ellipse_at_80%_40%,rgba(255,255,255,0.35),transparent_60%)]" />
      <div className="pointer-events-none absolute -top-10 left-0 right-0 h-10 bg-white rounded-b-[100%]" />
      <div id="para-quem-e" className={`${CONTAINER} relative py-12 md:py-16 grid lg:grid-cols-[0.7fr_1.9fr] gap-8 lg:gap-10 items-center scroll-mt-24`}>
        <div className="space-y-4 text-white">
          <Eyebrow light>Soluções para a sua operação</Eyebrow>
          <h2 className="text-3xl md:text-[2.3rem] font-extrabold tracking-tight leading-tight [text-wrap:balance]">
            Mais conversão em <span className="text-[#7CF2B8]">diferentes cenários.</span>
          </h2>
          <span className="block h-1 w-16 rounded-full bg-[#1DB954]" aria-hidden />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          {cards.map(({ icon: Icon, title, featured }, i) => (
            <div
              key={i}
              className={`rounded-[22px] p-5 min-h-[176px] flex flex-col justify-between gap-4 text-white ${
                featured ? "bg-gradient-to-b from-[#25D366] to-[#1DB954] shadow-[0_18px_40px_rgba(29,185,84,0.35)]" : "bg-white/[0.07] border border-white/10"
              }`}
            >
              <Icon className="h-6 w-6 shrink-0" strokeWidth={1.6} aria-hidden />
              <div className="space-y-3">
                <p className="text-[15px] font-bold leading-snug [text-wrap:balance]">{title}</p>
                {/* seta decorativa: estes cards não têm destino no app */}
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${featured ? "bg-white text-[#0E8A5F]" : "bg-white text-[#003D2B]"}`} aria-hidden>
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==================== BENEFÍCIOS ====================
const BenefitsSection = () => {
  const benefits = [
    { icon: ChartNoAxesCombined, label: <>Maior taxa<br />de conversão</> },
    { icon: WalletCards, label: <>Mais opções<br />de pagamento</> },
    { icon: ShieldCheck, label: <>Segurança e<br />confiabilidade</> },
    { icon: Zap, label: <>Implantação<br />rápida</> },
    { icon: Headset, label: <>Suporte<br />especializado</> },
  ];
  return (
    <section className={`${CONTAINER} py-10 md:py-14 grid lg:grid-cols-[0.8fr_1.6fr] gap-8 lg:gap-12 items-center`}>
      <div className="space-y-2">
        <Eyebrow>Por que escolher a Combinaí</Eyebrow>
        <h2 className="text-3xl md:text-[2.3rem] font-extrabold tracking-tight leading-tight">Mais resultados<br />para a sua operação.</h2>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-6">
        {benefits.map(({ icon: Icon, label }, i) => (
          <li key={i} className={`flex flex-col items-center text-center gap-3 px-3 ${i > 0 ? "lg:border-l lg:border-slate-200" : ""}`}>
            <Icon className="h-7 w-7 text-[#0E8A5F]" strokeWidth={1.5} aria-hidden />
            <span className="text-[15px] font-medium text-[#101820] leading-snug">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

// ==================== SOBRE ====================
const AboutSection = ({ onOpenLeadModal }: { onOpenLeadModal: () => void }) => {
  const pillars = [
    { icon: Target, title: "Missão", text: "Facilitar pagamentos e ampliar oportunidades de recebimento com tecnologia, flexibilidade e segurança." },
    { icon: Eye, title: "Visão", text: "Ser referência nacional em soluções inteligentes e flexíveis de pagamento." },
    { icon: Gem, title: "Valores", text: "Pessoas em primeiro lugar, flexibilidade, inovação, segurança, simplicidade, transparência e resultados compartilhados." },
  ];
  return (
    <section id="sobre" className="relative overflow-hidden scroll-mt-24">
      <div className="pointer-events-none absolute -right-40 -bottom-56 h-[420px] w-[560px] rounded-[50%] bg-gradient-to-br from-[#1DB954]/25 to-transparent" />
      <div className={`${CONTAINER} relative py-6 md:py-10 grid lg:grid-cols-[0.95fr_1.3fr] gap-10 lg:gap-14 items-center`}>
        <div className="space-y-5 max-w-[480px]">
          <Eyebrow>Sobre a Combinaí</Eyebrow>
          <h2 className="text-3xl md:text-[2.3rem] font-extrabold tracking-tight leading-tight">Tecnologia, flexibilidade<br />e propósito.</h2>
          <p className="text-[16px] text-[#3B4652] leading-[1.65]">
            A Combinaí é uma empresa de tecnologia em pagamentos que conecta pessoas e empresas por meio de soluções simples, seguras e inteligentes.
          </p>
          {/* Ponto pendente: não há página de história no app; abre o mesmo canal de contato */}
          <Button onClick={onOpenLeadModal} variant="outline" className="h-11 rounded-full px-6 border-[1.5px] border-[#1DB954] text-[#101820] font-semibold bg-white hover:bg-[#F1FBF6] hover:text-[#101820]">
            Conheça nossa história
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3 lg:border-l lg:border-slate-200 lg:pl-10">
          {pillars.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-[18px] bg-[#F3FAF6] px-5 py-4 grid sm:grid-cols-[auto_110px_1fr] items-center gap-4">
              <span className="h-11 w-11 rounded-xl bg-white text-[#0E8A5F] flex items-center justify-center"><Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden /></span>
              <h3 className="text-[17px] font-bold">{title}</h3>
              <p className="text-[15px] text-[#3B4652] leading-[1.6]">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==================== CTA FINAL ====================
const FinalCTASection = ({ onOpenLeadModal }: { onOpenLeadModal: () => void }) => (
  <section id="contato" className="relative overflow-hidden scroll-mt-24 mt-6 md:mt-8" style={{ background: `linear-gradient(100deg, ${DARK} 0%, #0B5A3F 100%)` }}>
    <div className="pointer-events-none absolute -top-8 left-0 right-0 h-8 bg-white rounded-b-[100%]" />
    <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-[520px] rounded-[50%] bg-gradient-to-r from-[#1DB954] to-transparent opacity-50" />
    <div className="pointer-events-none absolute -bottom-40 right-0 h-80 w-[520px] rounded-[50%] bg-gradient-to-l from-[#25D366] to-transparent opacity-40" />
    <div className={`${CONTAINER} relative py-12 md:py-16 grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center text-white`}>
      <div className="space-y-3">
        <h2 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tight">Vamos conversar?</h2>
        <p className="text-white/85 text-[17px] leading-relaxed max-w-[520px]">
          Descubra como a Combinaí pode aumentar a conversão dos seus acordos e reduzir a inadimplência.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 lg:justify-end">
        <Button size="lg" onClick={onOpenLeadModal} className="h-12 rounded-full px-6 text-[15px] font-semibold bg-white text-[#003D2B] hover:bg-[#F1FBF6]">
          <Headphones className="mr-2 h-4.5 w-4.5 text-[#0E8A5F]" />
          Falar com um especialista
        </Button>
        <Button size="lg" onClick={onOpenLeadModal} className="h-12 rounded-full px-7 text-[15px] font-semibold text-white border-0" style={{ background: `linear-gradient(90deg, #25D366 0%, #1DB954 100%)` }}>
          Criar minha conta
          <ArrowRight className="ml-2 h-4.5 w-4.5" />
        </Button>
      </div>
    </div>
  </section>
);

// ==================== RODAPÉ (conteúdo e destinos preservados) ====================
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
    <footer className="bg-[#F3FAF6] border-t border-[#0E8A5F]/10 py-12">
      <div className={`${CONTAINER} grid md:grid-cols-3 gap-8`}>
        <div>
          {/* logotipo oficial com canal alpha, direto sobre o fundo (sem caixa) */}
          <Logo className="h-auto w-[132px] sm:w-[144px]" />
          <p className="text-[#3B4652]/80 text-sm mt-4">© {new Date().getFullYear()} Combinaí. Todos os direitos reservados.</p>
        </div>
        <div>
          <p className="text-[#101820] font-semibold mb-4">Produto</p>
          <div className="space-y-2">
            {links.produto.map((link) => (
              <a key={link.label} href={link.href} className="block text-[#3B4652] hover:text-[#0E8A5F] text-sm transition-colors">{link.label}</a>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[#101820] font-semibold mb-4">Legal</p>
          <div className="space-y-2">
            {links.legal.map((link) => (
              <a key={link.label} href={link.href} className="block text-[#3B4652] hover:text-[#0E8A5F] text-sm transition-colors">{link.label}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
