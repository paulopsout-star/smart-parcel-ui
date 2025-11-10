import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface FieldSkeletonProps {
  rows?: number;
}

export const FieldSkeleton: React.FC<FieldSkeletonProps> = ({ rows = 1 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
};
