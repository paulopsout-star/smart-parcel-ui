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
        'relative bg-ds-bg-surface rounded-card p-6 shadow-card-soft transition-all duration-200 hover:shadow-floating hover:scale-[1.01]',
        variant === 'highlight' && 'ring-2 ring-brand/20',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-brand" />
          </div>
          <span className="text-sm font-medium text-ds-text-muted">{label}</span>
        </div>
        {delta && <DeltaPill value={delta.value} type={delta.type} />}
      </div>

      {/* Value */}
      <div className="mb-1">
        <span className="text-3xl font-bold text-ds-text-strong tracking-tight">{value}</span>
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-ds-text-muted">{description}</p>
      )}
    </div>
  );
}
