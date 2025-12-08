import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface DeltaPillProps {
  value: number;
  type: 'increase' | 'decrease';
  className?: string;
}

export function DeltaPill({ value, type, className }: DeltaPillProps) {
  const isPositive = type === 'increase';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
        isPositive
          ? 'bg-brand/10 text-brand'
          : 'bg-feedback-error/10 text-feedback-error',
        className
      )}
    >
      {isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {isPositive ? '+' : ''}{value}%
    </span>
  );
}
