import React from 'react';
import { Label } from '@/components/ui/label';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  helpText?: string;
  helpIcon?: boolean;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  error,
  helpText,
  helpIcon = false,
  required = false,
  children,
  className
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label
          htmlFor={htmlFor}
          className="font-medium text-sm text-ink flex items-center gap-1"
        >
          {label}
          {required && <span className="text-brand">*</span>}
        </Label>
        
        {helpText && (
          <div className="flex items-center gap-1 text-xs text-ink-muted">
            {helpIcon && <Info className="w-3 h-3" />}
            <span>{helpText}</span>
          </div>
        )}
      </div>
      
      {children}
      
      {error && (
        <div className="flex items-start gap-2 mt-1" role="alert">
          <span className="text-sm text-feedback-error">{error}</span>
        </div>
      )}
    </div>
  );
};
