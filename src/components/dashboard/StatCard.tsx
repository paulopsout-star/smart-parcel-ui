import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeltaPill } from './DeltaPill';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description?: string;
  delta?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  variant?: 'default' | 'highlight';
  className?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  description,
  delta,
  variant = 'default',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'relative bg-ds-bg-surface rounded-card p-4 lg:p-5 xl:p-6 shadow-card-soft',
        'transition-all duration-200 hover:shadow-floating hover:scale-[1.01]',
        'overflow-hidden min-h-[140px] h-full flex flex-col justify-between',
        variant === 'highlight' && 'ring-2 ring-brand/20',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 lg:mb-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 lg:w-5 lg:h-5 text-brand" />
          </div>
          <span className="text-xs lg:text-sm font-medium text-ds-text-muted line-clamp-2 leading-tight">{label}</span>
        </div>
        {delta && <DeltaPill value={delta.value} type={delta.type} />}
      </div>

      {/* Value */}
      <div className="mb-2">
        <span 
          className="font-bold text-ds-text-strong tracking-tight whitespace-nowrap"
          style={{ 
            fontSize: 'clamp(1.25rem, 2.2vw, 2rem)',
            lineHeight: '1.2',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {value}
        </span>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs lg:text-sm text-ds-text-muted line-clamp-2 mt-auto">{description}</p>
      )}
    </div>
  );
}
