import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

interface SecurityBadgeProps {
  text: string;
  className?: string;
}

const SecurityBadge = ({ text, className }: SecurityBadgeProps) => {
  return (
    <div 
      className={cn(
        "flex items-center gap-3 text-autopay-text",
        className
      )}
    >
      <CheckCircle2 className="w-6 h-6 text-autopay-primary-strong flex-shrink-0" />
      <span className="text-base font-medium">{text}</span>
    </div>
  );
};

export default SecurityBadge;
