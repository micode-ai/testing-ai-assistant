import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { TestRunStatus } from '@/types';
import type { ViewStyle } from 'react-native';

interface RunStatusBadgeProps {
  status: TestRunStatus;
  style?: ViewStyle;
}

const statusConfig: Record<
  TestRunStatus,
  { label: string; variant: 'default' | 'success' | 'error' | 'warning' | 'info' }
> = {
  QUEUED: { label: 'Queued', variant: 'default' },
  RUNNING: { label: 'Running', variant: 'info' },
  PASSED: { label: 'Passed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'error' },
  CANCELLED: { label: 'Cancelled', variant: 'warning' },
  TIMED_OUT: { label: 'Timed Out', variant: 'warning' },
};

export function RunStatusBadge({ status, style }: RunStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.QUEUED;
  return <Badge label={config.label} variant={config.variant} style={style} />;
}
