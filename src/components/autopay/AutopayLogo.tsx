import { cn } from "@/lib/utils";

interface AutopayLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
}

const AutopayLogo = ({ className, size = "md", variant = "dark" }: AutopayLogoProps) => {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  const textColor = variant === "dark" ? "text-autopay-text" : "text-white";

  return (
    <div className={cn("flex items-center font-bold", sizeClasses[size], className)}>
      <span className={textColor}>Auto</span>
      <span className="bg-autopay-primary text-autopay-text px-2 py-0.5 rounded-full">
        pay
      </span>
    </div>
  );
};

export default AutopayLogo;
