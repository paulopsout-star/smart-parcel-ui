import { cn } from "@/lib/utils";
import { ChevronRight, MessageSquare } from "lucide-react";
import { useState } from "react";

interface ChatPromptItemProps {
  text: string;
  className?: string;
  delay?: number;
}

const ChatPromptItem = ({ text, className, delay = 0 }: ChatPromptItemProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-full",
        "bg-autopay-bg hover:bg-[#EDEDED]",
        "cursor-pointer transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-md",
        "opacity-0 animate-slide-up-stagger",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-8 h-8 rounded-full bg-autopay-primary/20 flex items-center justify-center flex-shrink-0">
        <MessageSquare className="w-4 h-4 text-autopay-primary-strong" />
      </div>
      <span className="flex-1 text-sm text-autopay-text font-medium">{text}</span>
      <ChevronRight 
        className={cn(
          "w-4 h-4 text-autopay-text-secondary transition-all duration-200",
          isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
        )} 
      />
    </div>
  );
};

export default ChatPromptItem;
