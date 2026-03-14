'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Play, Power, PowerOff, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getPipeline, updatePipeline, triggerRun } from '@/lib/api/pipelines';
import { getTestRuns } from '@/lib/api/test-runs';
import { getProject } from '@/lib/api/projects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { RunStatusBadge } from '@/components/shared/run-status-badge';
import type { Pipeline, TestRun } from '@/types';

export default function PipelineDetailPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string; pipelineId: string }>();
  const { projectId, pipelineId } = params;
  const { data: session } = useSession();
  const t = useTranslations('pipelines');
  const tc = useTranslations('common');
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const fetchData = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const pipelineData = await getPipeline(pipelineId, token);
      setPipeline(pipelineData);
      try {
        const project = await getProject(projectId, token);
        setDefaultBranch(project.defaultBranch || 'main');
      } catch {
        // Use default branch
      }
      try {
        const runsData = await getTestRuns(pipelineId, token);
        setRuns(runsData);
      } catch {
        // Runs endpoint may not be available yet
      }
    } catch {
      // Pipeline not found
    } finally {
      setIsLoading(false);
    }
  }, [pipelineId, projectId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function onTriggerRun() {
    setIsTriggering(true);
    try {
      const result = await triggerRun(pipelineId, { branch: defaultBranch }, token);
      router.push(`/runs/${result.id}`);
    } catch {
      // Stay on page
    } finally {
      setIsTriggering(false);
    }
  }

  async function onToggleEnabled() {
    if (!pipeline) return;
    setIsToggling(true);
    try {
      const updated = await updatePipeline(pipelineId, { enabled: !pipeline.enabled }, token);
      setPipeline(updated);
    } catch {
      // Silently fail
    } finally {
      setIsToggling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{pipeline.name}</h2>
          <p className="text-muted-foreground">
            {t('trigger')} {pipeline.triggerType}
            {pipeline.cronExpression && ` (${pipeline.cronExpression})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/pipelines/${pipelineId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              {tc('edit')}
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={onToggleEnabled}
            disabled={isToggling}
          >
            {pipeline.enabled ? (
              <><PowerOff className="mr-2 h-4 w-4" /> {tc('disable')}</>
            ) : (
              <><Power className="mr-2 h-4 w-4" /> {tc('enable')}</>
            )}
          </Button>
          <Button onClick={onTriggerRun} disabled={isTriggering}>
            <Play className="mr-2 h-4 w-4" />
            {isTriggering ? t('triggering') : t('triggerRun')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={pipeline.enabled ? 'default' : 'secondary'}>
          {pipeline.enabled ? tc('enabled') : tc('disabled')}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {t('stepsCount', { count: pipeline.steps.length })}
        </span>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">{tc('steps')}</h3>
        <div className="space-y-2">
          {pipeline.steps
            .sort((a, b) => a.order - b.order)
            .map((step, index) => (
              <Card key={step.id}>
                <CardHeader className="py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {index + 1}
                    </span>
                    <div>
                      <CardTitle className="text-sm">{step.name}</CardTitle>
                      <CardDescription className="text-xs">{step.checkType}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">{t('recentRuns')}</h3>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noRunsYet')}</p>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <Link key={run.id} href={`/runs/${run.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-4">
                      <RunStatusBadge status={run.status} />
                      <div className="text-sm">
                        <span className="font-mono text-xs">{run.commitSha?.slice(0, 7)}</span>
                        {run.branch && (
                          <span className="ml-2 text-muted-foreground">{run.branch}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
