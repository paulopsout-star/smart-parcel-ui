import { cn } from "@/lib/utils";

interface HandDrawnArrowProps {
  className?: string;
}

const HandDrawnArrow = ({ className }: HandDrawnArrowProps) => {
  return (
    <svg 
      className={cn("w-24 h-16", className)}
      viewBox="0 0 100 60" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M5 45 C20 50, 40 40, 60 35 S80 25, 92 15" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round"
        fill="none"
        className="animate-draw-path"
      />
      <path 
        d="M82 10 L95 15 L88 25" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};

export default HandDrawnArrow;
