'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  Clock, GitCommit, GitBranch, User, XCircle,
  ChevronDown, ChevronRight, Loader2,
  CheckCircle2, XOctagon, AlertTriangle, CircleDot,
} from 'lucide-react';
import { getTestRun, cancelTestRun, subscribeToRun } from '@/lib/api/test-runs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { RunStatusBadge } from '@/components/shared/run-status-badge';
import { ErrorAlert } from '@/components/shared/error-alert';
import { PageSkeleton } from '@/components/shared/page-skeleton';
import type { TestRun, RunStatus } from '@/types';

function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return '-';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'PASSED':
      return <CheckCircle2 className="h-5 w-5 text-status-passed" aria-label="Passed" />;
    case 'FAILED':
      return <XOctagon className="h-5 w-5 text-status-failed" aria-label="Failed" />;
    case 'ERRORED':
      return <AlertTriangle className="h-5 w-5 text-status-error" aria-label="Errored" />;
    case 'RUNNING':
      return <Loader2 className="h-5 w-5 text-status-running animate-spin" aria-label="Running" />;
    case 'CANCELLED':
      return <XCircle className="h-5 w-5 text-status-pending" aria-label="Cancelled" />;
    default:
      return <CircleDot className="h-5 w-5 text-status-pending" aria-label="Pending" />;
  }
}

function ProgressBar({ steps, stepsCompletedLabel }: { steps: TestRun['steps']; stepsCompletedLabel: string }) {
  const total = steps.length;
  if (total === 0) return null;

  const completed = steps.filter(
    (s) => s.status === 'PASSED' || s.status === 'FAILED' || s.status === 'ERRORED' || s.status === 'CANCELLED',
  ).length;
  const percent = Math.round((completed / total) * 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{stepsCompletedLabel}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** Renders known fields from step details in a readable way */
function StepDetails({ step }: { step: TestRun['steps'][number] }) {
  const details = step.details as Record<string, unknown> | null;
  if (!details) return null;

  const summary = details.summary as string | undefined;
  const output = details.output as string | undefined;
  const exitCode = details.exitCode as number | undefined;

  // Test results
  const totalTests = details.totalTests as number | undefined;
  const passed = details.passed as number | undefined;
  const failed = details.failed as number | undefined;
  const skipped = details.skipped as number | undefined;

  // Lint results
  const errors = details.errors as number | undefined;
  const warnings = details.warnings as number | undefined;

  // Security results
  const findings = details.findings as { pattern: string; severity: string; count: number }[] | undefined;
  const tool = details.tool as string | undefined;

  // Audit results
  const critical = details.critical as number | undefined;
  const high = details.high as number | undefined;
  const moderate = details.moderate as number | undefined;
  const low = details.low as number | undefined;

  return (
    <div className="space-y-3">
      {/* Summary */}
      {summary && (
        <div className="text-sm font-medium">{summary}</div>
      )}

      {/* Stats grid */}
      {(totalTests !== undefined || errors !== undefined || critical !== undefined) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {totalTests !== undefined && (
            <>
              <StatCard label="Total" value={totalTests} />
              <StatCard label="Passed" value={passed ?? 0} className="text-status-passed" />
              <StatCard label="Failed" value={failed ?? 0} className={failed ? 'text-status-failed' : ''} />
              <StatCard label="Skipped" value={skipped ?? 0} />
            </>
          )}
          {errors !== undefined && (
            <>
              <StatCard label="Errors" value={errors} className={errors ? 'text-status-failed' : 'text-status-passed'} />
              <StatCard label="Warnings" value={warnings ?? 0} className={warnings ? 'text-status-warning' : ''} />
            </>
          )}
          {critical !== undefined && (
            <>
              <StatCard label="Critical" value={critical} className={critical ? 'text-status-failed' : ''} />
              <StatCard label="High" value={high ?? 0} className={high ? 'text-status-failed' : ''} />
              <StatCard label="Moderate" value={moderate ?? 0} className={moderate ? 'text-status-warning' : ''} />
              <StatCard label="Low" value={low ?? 0} />
            </>
          )}
        </div>
      )}

      {/* Security findings */}
      {findings && findings.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Findings</p>
          {findings.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`inline-block w-2 h-2 rounded-full ${f.severity === 'high' ? 'bg-status-failed' : 'bg-status-warning'}`} />
              <span>{f.pattern}</span>
              <span className="text-muted-foreground">({f.count} file(s))</span>
            </div>
          ))}
        </div>
      )}

      {/* Tool info */}
      {tool && (
        <p className="text-xs text-muted-foreground">Tool: {tool}</p>
      )}

      {/* Exit code */}
      {exitCode !== undefined && exitCode !== 0 && (
        <p className="text-xs text-muted-foreground">Exit code: {exitCode}</p>
      )}

      {/* Output log */}
      {output && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Show output log
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-code-bg text-code-fg p-3 text-xs max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
            {output}
          </pre>
        </details>
      )}
    </div>
  );
}

function StatCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-md border px-3 py-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${className || ''}`}>{value}</p>
    </div>
  );
}

export default function RunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;
  const { data: session } = useSession();
  const t = useTranslations();
  const [run, setRun] = useState<TestRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [sseReady, setSseReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const fetchRun = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await getTestRun(runId, token);
      if (!data.steps) {
        data.steps = [];
      }
      setRun(data);
      const isTerminal = ['PASSED', 'FAILED', 'ERRORED', 'CANCELLED'].includes(data.status);
      if (!isTerminal) {
        setSseReady(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test run');
    } finally {
      setIsLoading(false);
    }
  }, [runId, token]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // SSE subscription for live updates
  useEffect(() => {
    if (!token || !sseReady) return;

    const es = subscribeToRun(runId, token);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type: string; status?: string };
        fetchRun();

        if (payload.type === 'run.finished' || (payload.status && ['PASSED', 'FAILED', 'ERRORED', 'CANCELLED'].includes(payload.status))) {
          setSseReady(false);
          es.close();
        }
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      setSseReady(false);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [runId, token, sseReady, fetchRun]);

  // Polling fallback: refresh every 3 seconds while run is active
  useEffect(() => {
    if (!token || !run) return;

    const isTerminal = ['PASSED', 'FAILED', 'ERRORED', 'CANCELLED'].includes(run.status);
    if (isTerminal) return;

    const interval = setInterval(() => {
      fetchRun();
    }, 3000);

    return () => clearInterval(interval);
  }, [token, run?.status, fetchRun]);

  async function onCancel() {
    setIsCancelling(true);
    try {
      const updated = await cancelTestRun(runId, token);
      setRun(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel test run');
    } finally {
      setIsCancelling(false);
    }
  }

  function toggleStep(stepId: string) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }

  if (isLoading) {
    return <PageSkeleton cards={4} />;
  }

  if (!run) {
    return (
      <div className="space-y-4">
        {error && <ErrorAlert message={error} onRetry={fetchRun} />}
        {!error && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('testRun.notFound')}</p>
          </div>
        )}
      </div>
    );
  }

  const isActive = run.status === 'QUEUED' || run.status === 'RUNNING';

  const steps = run.steps ?? [];

  const completedSteps = steps.filter(
    (s) => s.status === 'PASSED' || s.status === 'FAILED' || s.status === 'ERRORED' || s.status === 'CANCELLED',
  ).length;

  return (
    <div className="space-y-6">
      {error && <ErrorAlert message={error} onRetry={fetchRun} />}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">{t('testRun.title')}</h2>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="font-mono text-sm text-muted-foreground">{run.id}</p>
        </div>
        {isActive && (
          <Button variant="outline" onClick={onCancel} disabled={isCancelling}>
            <XCircle className="mr-2 h-4 w-4" />
            {isCancelling ? t('testRun.cancelling') : t('testRun.cancelRun')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {run.commitSha && (
          <div className="flex items-center gap-1">
            <GitCommit className="h-4 w-4" />
            <span className="font-mono">{run.commitSha.slice(0, 7)}</span>
          </div>
        )}
        {run.branch && (
          <div className="flex items-center gap-1">
            <GitBranch className="h-4 w-4" />
            <span>{run.branch}</span>
          </div>
        )}
        {run.triggeredBy && (
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            <span>{run.triggeredBy}</span>
          </div>
        )}
        {run.startedAt && (
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{t('testRun.started')} {new Date(run.startedAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      <ProgressBar
        steps={steps}
        stepsCompletedLabel={t('testRun.stepsCompleted', { completed: completedSteps, total: steps.length })}
      />

      <Separator />

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">{t('testRun.steps')}</h3>

        {steps.length === 0 && isActive && (
          <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t('testRun.waitingForSteps')}</span>
          </div>
        )}
        {steps.length === 0 && !isActive && (
          <p className="text-sm text-muted-foreground py-4">{t('testRun.noSteps')}</p>
        )}

        <div className="space-y-2">
          {steps
            .sort((a, b) => {
              const aOrder = a.startedAt ? new Date(a.startedAt).getTime() : Infinity;
              const bOrder = b.startedAt ? new Date(b.startedAt).getTime() : Infinity;
              return aOrder - bOrder;
            })
            .map((step) => {
              const isExpanded = expandedSteps.has(step.id);
              const isRunning = step.status === 'RUNNING';
              const hasDetails = step.details && Object.keys(step.details).length > 0;
              const summaryText = (step.details as Record<string, unknown>)?.summary as string | undefined;

              return (
                <Card key={step.id} className={`hover:shadow-md transition-shadow ${isRunning ? 'border-status-running/20 bg-status-running/5' : ''}`}>
                  <CardHeader
                    className={`cursor-pointer py-3 ${hasDetails ? '' : 'cursor-default'}`}
                    onClick={() => hasDetails && toggleStep(step.id)}
                    role={hasDetails ? 'button' : undefined}
                    tabIndex={hasDetails ? 0 : undefined}
                    onKeyDown={hasDetails ? (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleStep(step.id);
                      }
                    } : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StepStatusIcon status={step.status} />
                        <div>
                          <CardTitle className="text-sm font-medium">{step.name}</CardTitle>
                          {isRunning && (
                            <p className="text-xs text-status-running animate-pulse">
                              {summaryText || `${step.name} in progress...`}
                            </p>
                          )}
                          {!isRunning && summaryText && (
                            <p className="text-xs text-muted-foreground">{summaryText}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(step.duration)}
                        </span>
                        <RunStatusBadge status={step.status} />
                        {hasDetails && (
                          isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && hasDetails && (
                    <CardContent className="pt-0 pb-4">
                      <StepDetails step={step} />
                    </CardContent>
                  )}
                </Card>
              );
            })}
        </div>
      </div>
    </div>
  );
}
