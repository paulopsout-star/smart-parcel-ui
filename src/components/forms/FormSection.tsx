import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FormSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  icon,
  children,
  className
}) => {
  return (
    <Card className={cn('shadow-md border-border', className)}>
      <CardHeader className="border-b border-border bg-surface-light/50">
        <div className="flex items-center gap-2">
          {icon}
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-ink">
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="text-sm text-ink-secondary">
                {description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        {children}
      </CardContent>
    </Card>
  );
};
