'use client';

import { Skeleton } from '@/components/ui/skeleton';

interface PageSkeletonProps {
  /** Number of card rows to show */
  cards?: number;
  /** Show a header skeleton */
  header?: boolean;
}

export function PageSkeleton({ cards = 3, header = true }: PageSkeletonProps) {
  return (
    <div className="space-y-6">
      {header && (
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      )}
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}
