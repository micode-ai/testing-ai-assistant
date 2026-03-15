'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RunStatus } from '@/types';

const statusStyles: Record<RunStatus, string> = {
  QUEUED: 'bg-status-pending/15 text-status-pending border-status-pending/30',
  RUNNING: 'bg-status-running/15 text-status-running border-status-running/30 animate-pulse',
  PASSED: 'bg-status-passed/15 text-status-passed border-status-passed/30',
  FAILED: 'bg-status-failed/15 text-status-failed border-status-failed/30',
  ERRORED: 'bg-status-error/15 text-status-error border-status-error/30',
  CANCELLED: 'bg-status-pending/15 text-status-pending border-status-pending/30',
};

interface RunStatusBadgeProps {
  status: RunStatus;
  className?: string;
}

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  const t = useTranslations('runStatus');
  const style = statusStyles[status] ?? statusStyles.QUEUED;

  return (
    <Badge variant="outline" className={cn(style, className)} aria-label={`Status: ${status}`}>
      {t(status)}
    </Badge>
  );
}
