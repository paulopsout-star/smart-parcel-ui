import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface QuickActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
  onClick,
  variant = 'secondary',
}: QuickActionCardProps) {
  const content = (
    <div
      className={cn(
        'group relative flex items-center gap-4 p-4 rounded-card transition-all duration-200 cursor-pointer',
        variant === 'primary'
          ? 'bg-brand text-white shadow-btn-brand hover:scale-[1.02] hover:shadow-floating'
          : 'bg-ds-bg-surface border border-ds-border-subtle hover:border-brand/30 hover:shadow-card-soft'
      )}
    >
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
          variant === 'primary' ? 'bg-white/20' : 'bg-brand/10'
        )}
      >
        <Icon
          className={cn(
            'w-6 h-6 transition-transform group-hover:scale-110',
            variant === 'primary' ? 'text-white' : 'text-brand'
          )}
        />
      </div>
      <div>
        <h3
          className={cn(
            'font-semibold',
            variant === 'primary' ? 'text-white' : 'text-ds-text-strong'
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            'text-sm',
            variant === 'primary' ? 'text-white/80' : 'text-ds-text-muted'
          )}
        >
          {description}
        </p>
      </div>
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }

  return <div onClick={onClick}>{content}</div>;
}
