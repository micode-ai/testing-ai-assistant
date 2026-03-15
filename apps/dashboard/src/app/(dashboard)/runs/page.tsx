'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Clock, Play } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { RunStatusBadge } from '@/components/shared/run-status-badge';
import { PageSkeleton } from '@/components/shared/page-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import type { TestRun } from '@/types';

const PIPELINE_API_URL = process.env.NEXT_PUBLIC_PIPELINE_API_URL || 'http://localhost:3004';

async function getRecentRuns(token: string): Promise<TestRun[]> {
  const res = await fetch(`${PIPELINE_API_URL}/test-runs/recent`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export default function RunsListPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  function fetchRuns() {
    if (!token) return;
    setError(null);
    setIsLoading(true);
    getRecentRuns(token)
      .then(setRuns)
      .catch((err) => setError(err?.message || 'Failed to load runs'))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    if (!token) return;
    fetchRuns();
  }, [token]);

  if (isLoading) return <PageSkeleton cards={4} />;
  if (error) return <ErrorAlert message={error} onRetry={fetchRuns} />;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">{t('nav.runs')}</h2>

      {runs.length === 0 && (
        <EmptyState
          icon={Play}
          title={t('runs.noRuns')}
          description={t('runs.noRunsDescription')}
        />
      )}

      <div className="space-y-2">
        {runs.map((run) => (
          <Card
            key={run.id}
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/runs/${run.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push(`/runs/${run.id}`);
              }
            }}
          >
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RunStatusBadge status={run.status} />
                  <div>
                    <CardTitle className="text-sm font-mono">{run.id.slice(0, 8)}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {run.branch} &middot; {run.commitSha?.slice(0, 7)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <span>{new Date(run.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
