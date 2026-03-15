'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Clock, Play } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { RunStatusBadge } from '@/components/shared/run-status-badge';
import type { TestRun, RunStatus } from '@/types';

const PIPELINE_API_URL = process.env.NEXT_PUBLIC_PIPELINE_API_URL || 'http://localhost:3004';

async function getRecentRuns(token: string): Promise<TestRun[]> {
  const res = await fetch(`${PIPELINE_API_URL}/test-runs/recent`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    // Fallback: endpoint may not exist yet, return empty
    return [];
  }
  return res.json();
}

export default function RunsListPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  useEffect(() => {
    if (!token) return;
    getRecentRuns(token)
      .then(setRuns)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">{t('nav.runs')}</h2>

      {runs.length === 0 && (
        <div className="text-center py-12">
          <Play className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">{t('runs.noRuns')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('runs.noRunsDescription')}</p>
        </div>
      )}

      <div className="space-y-2">
        {runs.map((run) => (
          <Card
            key={run.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => router.push(`/runs/${run.id}`)}
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
                  <Clock className="h-3 w-3" />
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
