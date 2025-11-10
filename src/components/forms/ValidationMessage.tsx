import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValidationMessageProps {
  type: 'error' | 'warning' | 'success' | 'info';
  message: string;
  icon?: boolean;
  className?: string;
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({
  type,
  message,
  icon = true,
  className
}) => {
  const config = {
    error: {
      bgColor: 'bg-feedback-error-bg',
      textColor: 'text-feedback-error',
      borderColor: 'border-feedback-error',
      Icon: AlertCircle
    },
    warning: {
      bgColor: 'bg-feedback-warning-bg',
      textColor: 'text-feedback-warning',
      borderColor: 'border-feedback-warning',
      Icon: AlertTriangle
    },
    success: {
      bgColor: 'bg-feedback-success-bg',
      textColor: 'text-feedback-success',
      borderColor: 'border-feedback-success',
      Icon: CheckCircle
    },
    info: {
      bgColor: 'bg-feedback-info-bg',
      textColor: 'text-feedback-info',
      borderColor: 'border-feedback-info',
      Icon: Info
    }
  };

  const { bgColor, textColor, borderColor, Icon } = config[type];

  return (
    <div
      className={cn(
        'flex items-start gap-2 p-3 rounded-md border',
        bgColor,
        borderColor,
        className
      )}
      role="alert"
    >
      {icon && <Icon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', textColor)} />}
      <span className={cn('text-sm', textColor)}>{message}</span>
    </div>
  );
};
