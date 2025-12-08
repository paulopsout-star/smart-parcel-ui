import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import React from "react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  style?: React.CSSProperties;
}

const FeatureCard = ({ icon: Icon, title, description, className, style }: FeatureCardProps) => {
  return (
    <div 
      className={cn(
        "bg-white rounded-[20px] p-5 shadow-autopay-card-soft",
        "hover:shadow-autopay-card hover:-translate-y-1",
        "transition-all duration-300 ease-out",
        "border border-gray-100",
        className
      )}
      style={style}
    >
      <div className="flex items-start gap-4">
        {/* Ícone em container arredondado */}
        <div className="w-12 h-12 rounded-xl bg-autopay-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-autopay-primary-strong" strokeWidth={1.75} />
        </div>
        
        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-autopay-text mb-1">{title}</h3>
          <p className="text-sm text-autopay-text-secondary leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default FeatureCard;
