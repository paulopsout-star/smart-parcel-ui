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
        "bg-white rounded-[24px] p-6 shadow-autopay-card",
        "hover:shadow-autopay-floating hover:-translate-y-1",
        "transition-all duration-300 ease-out",
        className
      )}
      style={style}
    >
      <div className="w-14 h-14 rounded-2xl bg-autopay-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-autopay-primary-strong" strokeWidth={1.75} />
      </div>
      <h3 className="text-xl font-bold text-autopay-text mb-2">{title}</h3>
      <p className="text-sm text-autopay-text-secondary leading-relaxed">{description}</p>
    </div>
  );
};

export default FeatureCard;
