import { cn } from "@/lib/utils";
import { CreditCard, Smartphone, TrendingUp, Wallet } from "lucide-react";
interface DeviceMockupProps {
  variant: "light" | "dark";
  className?: string;
  animationDelay?: number;
}
const DeviceMockup = ({
  variant,
  className,
  animationDelay = 0
}: DeviceMockupProps) => {
  const baseClasses = "rounded-[32px] p-4 w-[220px] h-[420px] shadow-autopay-floating";
  return <div className={cn(baseClasses, variant === "light" ? "bg-white" : "bg-autopay-surface-dark", "animate-float-mockup", className)} style={{
    animationDelay: `${animationDelay}ms`
  }}>
      {variant === "light" ? <LightScreenContent /> : <DarkScreenContent />}
    </div>;
};
const LightScreenContent = () => <div className="h-full flex flex-col">
    {/* Status bar mockup */}
    <div className="flex justify-between items-center mb-4 text-xs text-autopay-text-secondary">
      <span>9:41</span>
      <div className="flex gap-1">
        <div className="w-4 h-2 bg-autopay-text rounded-sm" />
      </div>
    </div>
    
    {/* Header */}
    <div className="mb-6">
      <p className="text-xs text-autopay-text-secondary mb-1">Resumo da Cobrança</p>
      <p className="text-2xl font-bold text-autopay-text">R$ 1.250,00</p>
    </div>
    
    {/* Payment methods */}
    <div className="space-y-3 flex-1">
      <p className="text-xs text-autopay-text-secondary font-medium">Meios de Pagamento</p>
      
      <div className="bg-autopay-bg rounded-xl p-3 flex items-center gap-3 border-2 border-autopay-primary">
        <div className="w-10 h-10 rounded-full bg-autopay-primary/20 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-autopay-primary-strong" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-autopay-text">Cartão de Crédito</p>
          <p className="text-xs text-autopay-text-secondary">R$ 750,00 em 3x</p>
        </div>
        <div className="w-5 h-5 rounded-full bg-autopay-primary flex items-center justify-center">
          <svg className="w-3 h-3 text-autopay-text" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
      
      <div className="bg-autopay-bg rounded-xl p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-autopay-primary/20 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-autopay-primary-strong" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-autopay-text">PIX</p>
          <p className="text-xs text-autopay-text-secondary">R$ 500,00</p>
        </div>
      </div>
      
      <div className="bg-autopay-bg rounded-xl p-3 flex items-center gap-3 opacity-60">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-autopay-text">Outro Cartão</p>
          <p className="text-xs text-autopay-text-secondary">Adicionar...</p>
        </div>
      </div>
    </div>
    
    {/* CTA */}
    <button className="w-full text-white py-3 rounded-full font-semibold text-sm mt-4 bg-primary">
      Pagar Agora
    </button>
  </div>;
const DarkScreenContent = () => <div className="h-full flex flex-col text-white">
    {/* Status bar mockup */}
    <div className="flex justify-between items-center mb-4 text-xs text-white/60">
      <span>9:41</span>
      <div className="flex gap-1">
        <div className="w-4 h-2 bg-white rounded-sm" />
      </div>
    </div>
    
    {/* Header */}
    <div className="mb-6">
      <p className="text-xs text-white/60 mb-1">Vendas do Mês</p>
      <p className="text-2xl font-bold">R$ 45.320,00</p>
      <div className="flex items-center gap-1 text-autopay-primary mt-1">
        <TrendingUp className="w-4 h-4" />
        <span className="text-xs font-medium">+23% vs mês anterior</span>
      </div>
    </div>
    
    {/* Chart mockup */}
    <div className="flex-1 flex items-end gap-2 pb-4">
      {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 100].map((height, i) => <div key={i} className="flex-1 bg-autopay-primary/30 rounded-t-sm relative overflow-hidden" style={{
      height: `${height}%`
    }}>
          <div className="absolute bottom-0 left-0 right-0 bg-autopay-primary rounded-t-sm" style={{
        height: `${height * 0.7}%`
      }} />
        </div>)}
    </div>
    
    {/* Stats */}
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white/10 rounded-xl p-3">
        <p className="text-xs text-white/60">Transações</p>
        <p className="text-lg font-bold">234</p>
      </div>
      <div className="bg-white/10 rounded-xl p-3">
        <p className="text-xs text-white/60">Ticket Médio</p>
        <p className="text-lg font-bold">R$ 193</p>
      </div>
    </div>
  </div>;
export default DeviceMockup;