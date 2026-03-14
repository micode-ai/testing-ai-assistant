'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { CoverageSnapshot } from '@/types';

function getCoverageColor(value: number): string {
  if (value >= 80) return 'bg-green-500';
  if (value >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getCoverageTextColor(value: number): string {
  if (value >= 80) return 'text-green-700';
  if (value >= 60) return 'text-yellow-700';
  return 'text-red-700';
}

function TrendArrow({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return null;

  const diff = current - previous;
  if (Math.abs(diff) < 0.1) return null;

  return (
    <span className={cn('text-xs font-medium', diff > 0 ? 'text-green-600' : 'text-red-600')}>
      {diff > 0 ? '\u2191' : '\u2193'} {Math.abs(diff).toFixed(1)}%
    </span>
  );
}

interface CoverageBarProps {
  label: string;
  value: number;
  previousValue: number | null;
}

function CoverageBar({ label, value, previousValue }: CoverageBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className={cn('font-semibold', getCoverageTextColor(value))}>
            {value.toFixed(1)}%
          </span>
          <TrendArrow current={value} previous={previousValue} />
        </div>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getCoverageColor(value))}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface CoverageChartProps {
  current: CoverageSnapshot;
  previous?: CoverageSnapshot | null;
  className?: string;
}

export function CoverageChart({ current, previous, className }: CoverageChartProps) {
  const t = useTranslations('coverageChart');

  return (
    <div className={cn('space-y-4', className)}>
      <CoverageBar
        label={t('lineCoverage')}
        value={current.lineCoverage}
        previousValue={previous?.lineCoverage ?? null}
      />
      <CoverageBar
        label={t('branchCoverage')}
        value={current.branchCoverage}
        previousValue={previous?.branchCoverage ?? null}
      />
      <CoverageBar
        label={t('functionCoverage')}
        value={current.functionCoverage}
        previousValue={previous?.functionCoverage ?? null}
      />
    </div>
  );
}

interface CoverageTrendProps {
  snapshots: CoverageSnapshot[];
  className?: string;
}

export function CoverageTrend({ snapshots, className }: CoverageTrendProps) {
  const t = useTranslations('coverageChart');

  if (snapshots.length === 0) return null;

  const maxValue = 100;
  const barWidth = `${100 / snapshots.length}%`;

  return (
    <div className={cn('space-y-2', className)}>
      <h4 className="text-sm font-medium">{t('coverageTrend')}</h4>
      <div className="flex items-end gap-1 h-32">
        {snapshots.map((snapshot) => {
          const height = (snapshot.lineCoverage / maxValue) * 100;
          return (
            <div
              key={snapshot.id}
              className="flex flex-col items-center gap-1"
              style={{ width: barWidth }}
            >
              <span className="text-[10px] text-muted-foreground">
                {snapshot.lineCoverage.toFixed(0)}%
              </span>
              <div
                className={cn(
                  'w-full rounded-t transition-all duration-300',
                  getCoverageColor(snapshot.lineCoverage),
                )}
                style={{ height: `${height}%` }}
                title={`Line: ${snapshot.lineCoverage}% | Branch: ${snapshot.branchCoverage}% | Function: ${snapshot.functionCoverage}%`}
              />
              <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                {new Date(snapshot.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
