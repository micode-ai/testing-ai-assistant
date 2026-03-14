'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RunStatus } from '@/types';

const statusStyles: Record<RunStatus, string> = {
  QUEUED: 'bg-gray-100 text-gray-700 border-gray-200',
  RUNNING: 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse',
  PASSED: 'bg-green-100 text-green-700 border-green-200',
  FAILED: 'bg-red-100 text-red-700 border-red-200',
  ERRORED: 'bg-orange-100 text-orange-700 border-orange-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};

interface RunStatusBadgeProps {
  status: RunStatus;
  className?: string;
}

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  const t = useTranslations('runStatus');
  const style = statusStyles[status] ?? statusStyles.QUEUED;

  return (
    <Badge variant="outline" className={cn(style, className)}>
      {t(status)}
    </Badge>
  );
}
