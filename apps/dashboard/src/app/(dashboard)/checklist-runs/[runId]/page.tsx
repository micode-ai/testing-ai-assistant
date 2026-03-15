'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  CheckCircle2, XOctagon, AlertTriangle, Loader2, CircleDot, Clock, Globe,
} from 'lucide-react';
import { getChecklistRun, type ChecklistRun } from '@/lib/api/checklists';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { RunStatusBadge } from '@/components/shared/run-status-badge';
import { PageSkeleton } from '@/components/shared/page-skeleton';
import { ErrorAlert } from '@/components/shared/error-alert';

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function ItemStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'PASSED': return <CheckCircle2 className="h-5 w-5 text-status-passed" aria-label="Passed" />;
    case 'FAILED': return <XOctagon className="h-5 w-5 text-status-failed" aria-label="Failed" />;
    case 'RUNNING': return <Loader2 className="h-5 w-5 text-status-running animate-spin" aria-label="Running" />;
    case 'SKIPPED': return <AlertTriangle className="h-5 w-5 text-status-error" aria-label="Skipped" />;
    default: return <CircleDot className="h-5 w-5 text-status-pending" aria-label="Pending" />;
  }
}

export default function ChecklistRunPage() {
  const params = useParams<{ runId: string }>();
  const { data: session } = useSession();
  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;
  const [run, setRun] = useState<ChecklistRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRun = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await getChecklistRun(params.runId, token);
      setRun(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load checklist run');
    } finally {
      setIsLoading(false);
    }
  }, [params.runId, token]);

  useEffect(() => { fetchRun(); }, [fetchRun]);

  // Poll while active
  useEffect(() => {
    if (!token || !run) return;
    const isTerminal = ['PASSED', 'FAILED', 'ERRORED', 'CANCELLED'].includes(run.status);
    if (isTerminal) return;

    const interval = setInterval(fetchRun, 3000);
    return () => clearInterval(interval);
  }, [token, run?.status, fetchRun]);

  if (isLoading) {
    return <PageSkeleton cards={4} />;
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={fetchRun} />;
  }

  if (!run) {
    return <p className="text-center py-12 text-muted-foreground">Run not found</p>;
  }

  const results = run.itemResults ?? [];
  const completed = results.filter((r) => ['PASSED', 'FAILED', 'SKIPPED'].includes(r.status)).length;
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isActive = run.status === 'QUEUED' || run.status === 'RUNNING';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight">Checklist Run</h2>
          <RunStatusBadge status={run.status as any} />
        </div>
        <p className="font-mono text-sm text-muted-foreground">{run.id}</p>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Globe className="h-4 w-4" />
          <span className="font-mono">{run.targetUrl}</span>
        </div>
        {run.startedAt && (
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>Started {new Date(run.startedAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total" value={total} />
        <StatCard label="Passed" value={passed} className="text-status-passed" />
        <StatCard label="Failed" value={failed} className={failed > 0 ? 'text-status-failed' : ''} />
        <StatCard label="Progress" value={`${progressPct}%`} />
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {isActive && total === 0 && (
        <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Waiting for test execution to start...</span>
        </div>
      )}

      <Separator />

      {/* Item results */}
      <div className="space-y-2">
        {results.map((r) => {
          const details = r.details as Record<string, unknown>;
          const output = details?.output as string | undefined;
          const isRunning = r.status === 'RUNNING';

          return (
            <Card key={r.id} className={`hover:shadow-md transition-shadow ${isRunning ? 'border-status-running/20 bg-status-running/5' : ''}`}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ItemStatusIcon status={r.status} />
                    <div>
                      <CardTitle className="text-sm font-medium">
                        {r.item?.title || r.itemId}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{r.summary}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDuration(r.durationMs)}</span>
                </div>
              </CardHeader>

              {output && (
                <CardContent className="pt-0">
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      Show output
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-code-bg text-code-fg p-3 text-xs max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
                      {output}
                    </pre>
                  </details>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <div className="rounded-md border px-3 py-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${className || ''}`}>{value}</p>
    </div>
  );
}
