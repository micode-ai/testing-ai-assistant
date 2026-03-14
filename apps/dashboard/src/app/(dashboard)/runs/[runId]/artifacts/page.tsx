'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { getTestRun } from '@/lib/api/test-runs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ArtifactViewer, type Artifact, type ArtifactType } from '@/components/shared/artifact-viewer';
import type { TestRun, TestRunStep } from '@/types';

function inferArtifactType(url: string): ArtifactType {
  const lower = url.toLowerCase();
  if (lower.match(/\.(png|jpg|jpeg|gif|webp|bmp)(\?|$)/)) return 'screenshot';
  if (lower.match(/\.(mp4|webm|mov|avi)(\?|$)/)) return 'video';
  return 'report';
}

function extractArtifacts(steps: TestRunStep[]): Map<string, Artifact[]> {
  const grouped = new Map<string, Artifact[]>();

  steps.forEach((step) => {
    const artifacts: Artifact[] = [];

    if (step.details) {
      const urls: string[] = [];

      if (typeof step.details.artifactUrl === 'string') {
        urls.push(step.details.artifactUrl);
      }

      if (Array.isArray(step.details.artifactUrls)) {
        urls.push(...(step.details.artifactUrls as string[]));
      }

      if (Array.isArray(step.details.artifacts)) {
        (step.details.artifacts as Array<Record<string, unknown>>).forEach((a, i) => {
          artifacts.push({
            id: `${step.id}-artifact-${i}`,
            name: (a.name as string) || `Artifact ${i + 1}`,
            type: (a.type as ArtifactType) || inferArtifactType((a.url as string) || ''),
            url: (a.url as string) || '',
            stepName: step.name,
          });
        });
      }

      urls.forEach((url, i) => {
        artifacts.push({
          id: `${step.id}-url-${i}`,
          name: url.split('/').pop() || `Artifact ${i + 1}`,
          type: inferArtifactType(url),
          url,
          stepName: step.name,
        });
      });
    }

    if (artifacts.length > 0) {
      grouped.set(step.name, artifacts);
    }
  });

  return grouped;
}

export default function RunArtifactsPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;
  const { data: session } = useSession();
  const t = useTranslations();
  const [run, setRun] = useState<TestRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const fetchRun = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await getTestRun(runId, token);
      setRun(data);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [runId, token]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('artifacts.notFound')}</p>
      </div>
    );
  }

  const artifactsByStep = extractArtifacts(run.steps);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/runs/${runId}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t('common.back')}
            </Link>
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">{t('artifacts.title')}</h2>
        </div>
        <p className="font-mono text-sm text-muted-foreground">{run.id}</p>
      </div>

      <Separator />

      {artifactsByStep.size === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('artifacts.noArtifacts')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(artifactsByStep.entries()).map(([stepName, artifacts]) => (
            <div key={stepName} className="space-y-4">
              <h3 className="text-lg font-semibold">{stepName}</h3>
              <ArtifactViewer artifacts={artifacts} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
