import { useEffect, useState, useRef } from "react";
import { TrendingUp, Building2, CreditCard, Shield } from "lucide-react";

interface StatItemProps {
  icon: React.ReactNode;
  value: number;
  suffix: string;
  label: string;
  delay: number;
}

function StatItem({ icon, value, suffix, label, delay }: StatItemProps) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const timeout = setTimeout(() => {
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }, delay);

    return () => clearTimeout(timeout);
  }, [isVisible, value, delay]);

  return (
    <div
      ref={ref}
      className="group relative p-6 rounded-2xl glass-card hover:scale-105 transition-all duration-500"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand to-accent flex items-center justify-center mb-4 shadow-lg shadow-brand/20 group-hover:shadow-brand/40 transition-shadow duration-500">
          {icon}
        </div>
        <div className="text-4xl md:text-5xl font-bold text-foreground mb-2">
          <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
            {count.toLocaleString('pt-BR')}
          </span>
          <span className="text-brand">{suffix}</span>
        </div>
        <div className="text-muted-foreground font-medium">{label}</div>
      </div>
    </div>
  );
}

export function StatsCounter() {
  const stats = [
    {
      icon: <Building2 className="h-7 w-7 text-white" />,
      value: 500,
      suffix: "+",
      label: "Empresas Ativas",
      delay: 0,
    },
    {
      icon: <TrendingUp className="h-7 w-7 text-white" />,
      value: 150,
      suffix: "M+",
      label: "Volume Processado",
      delay: 150,
    },
    {
      icon: <CreditCard className="h-7 w-7 text-white" />,
      value: 98,
      suffix: "%",
      label: "Taxa de Aprovação",
      delay: 300,
    },
    {
      icon: <Shield className="h-7 w-7 text-white" />,
      value: 0,
      suffix: "",
      label: "Chargebacks",
      delay: 450,
    },
  ];

  return (
    <section className="py-20 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/50 to-background" />
      <div className="absolute inset-0 grid-pattern opacity-30" />
      
      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Números que <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">impressionam</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Resultados reais de quem confia na nossa plataforma
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {stats.map((stat, index) => (
            <StatItem key={index} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
}
