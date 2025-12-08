import { TrendingUp, CreditCard, Smartphone } from "lucide-react";

const FeaturesMockup = () => {
  return (
    <div className="relative w-full max-w-[520px] h-[420px]">
      
      {/* Cartão preto - Dashboard com Line Chart */}
      <div className="absolute left-0 top-0 w-[340px] h-[300px] 
                      bg-autopay-surface-dark rounded-[28px] p-6
                      shadow-autopay-floating">
        {/* Header */}
        <p className="text-white/60 text-sm font-medium">Vendas do Mês</p>
        <p className="text-white text-3xl font-bold mt-1">R$ 45.320</p>
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-autopay-primary/20">
            <TrendingUp className="w-3 h-3 text-autopay-primary" />
          </div>
          <span className="text-autopay-primary text-sm font-semibold">+23.5%</span>
          <span className="text-white/40 text-xs">vs mês anterior</span>
        </div>
        
        {/* Line Chart SVG */}
        <div className="mt-6 relative">
          <svg viewBox="0 0 280 100" className="w-full h-[100px]">
            {/* Grid lines */}
            <line x1="0" y1="25" x2="280" y2="25" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="0" y1="50" x2="280" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="0" y1="75" x2="280" y2="75" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            
            {/* Area gradient */}
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(152 74% 62%)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(152 74% 62%)" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {/* Area fill */}
            <path 
              d="M0,80 L35,65 L70,70 L105,45 L140,55 L175,30 L210,40 L245,20 L280,15 L280,100 L0,100 Z"
              fill="url(#chartGradient)"
            />
            
            {/* Line */}
            <polyline 
              fill="none" 
              stroke="hsl(152 74% 62%)" 
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="0,80 35,65 70,70 105,45 140,55 175,30 210,40 245,20 280,15"
            />
            
            {/* Dot at end */}
            <circle cx="280" cy="15" r="5" fill="hsl(152 74% 62%)" />
            <circle cx="280" cy="15" r="8" fill="hsl(152 74% 62%)" fillOpacity="0.3" />
          </svg>
        </div>
        
        {/* Stats row */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
          <div>
            <p className="text-white/40 text-xs">Transações</p>
            <p className="text-white font-semibold">1.284</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Ticket Médio</p>
            <p className="text-white font-semibold">R$ 35,28</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Conversão</p>
            <p className="text-white font-semibold">94.2%</p>
          </div>
        </div>
      </div>
      
      {/* Celular branco - sobreposto com animação float */}
      <div className="absolute right-0 bottom-0 w-[200px] h-[380px]
                      bg-white rounded-[32px] p-3
                      shadow-autopay-floating
                      animate-float-mockup z-10
                      border border-gray-100">
        
        {/* Phone notch */}
        <div className="w-20 h-5 bg-black rounded-full mx-auto mb-3" />
        
        {/* Phone content */}
        <div className="bg-gray-50 rounded-[20px] h-[calc(100%-32px)] p-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] text-gray-400 font-medium">PAGAMENTO</p>
              <p className="text-sm font-bold text-autopay-text">R$ 1.250,00</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-autopay-primary/10 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-autopay-primary-strong" />
            </div>
          </div>
          
          {/* Payment methods */}
          <div className="space-y-2">
            {/* PIX option */}
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-teal-500/10 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-teal-600">PIX</span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-medium text-autopay-text">PIX</p>
                  <p className="text-[8px] text-gray-400">Aprovação instantânea</p>
                </div>
                <p className="text-[10px] font-bold text-autopay-text">R$ 500</p>
              </div>
            </div>
            
            {/* Card option */}
            <div className="bg-white rounded-xl p-3 border-2 border-autopay-primary">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-autopay-primary/10 flex items-center justify-center">
                  <CreditCard className="w-3 h-3 text-autopay-primary-strong" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-medium text-autopay-text">Cartão</p>
                  <p className="text-[8px] text-gray-400">Em 6x sem juros</p>
                </div>
                <p className="text-[10px] font-bold text-autopay-text">R$ 750</p>
              </div>
            </div>
          </div>
          
          {/* Divider */}
          <div className="my-3 border-t border-gray-200" />
          
          {/* Total */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-gray-500">Total</p>
            <p className="text-sm font-bold text-autopay-text">R$ 1.250,00</p>
          </div>
          
          {/* Pay button */}
          <button className="w-full py-2.5 bg-autopay-primary-strong rounded-xl text-white text-xs font-semibold">
            Pagar Agora
          </button>
        </div>
      </div>
      
    </div>
  );
};

export default FeaturesMockup;
