import Link from 'next/link';
import { Plus, Zap } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getPipelines } from '@/lib/api/pipelines';
import type { Pipeline } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

interface PipelinesPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function PipelinesPage({ params }: PipelinesPageProps) {
  const { projectId } = await params;
  const t = await getTranslations('pipelines');
  const tc = await getTranslations('common');

  let pipelines: Pipeline[] = [];
  try {
    pipelines = await getPipelines(projectId);
  } catch {
    pipelines = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href={`/projects/${projectId}/pipelines/new`}>
            <Plus className="mr-2 h-4 w-4" />
            {t('newPipeline')}
          </Link>
        </Button>
      </div>

      {pipelines.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">{t('noPipelinesYet')}</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
              {t('noPipelinesDesc')}
            </p>
            <Button asChild className="mt-4">
              <Link href={`/projects/${projectId}/pipelines/new`}>
                <Plus className="mr-2 h-4 w-4" />
                {t('createPipeline')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pipelines.map((pipeline) => (
            <Link key={pipeline.id} href={`/projects/${projectId}/pipelines/${pipeline.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                    <Badge variant={pipeline.enabled ? 'default' : 'secondary'}>
                      {pipeline.enabled ? tc('enabled') : tc('disabled')}
                    </Badge>
                  </div>
                  <CardDescription>
                    {t('trigger')} {pipeline.triggerType}
                    {pipeline.cronExpression && ` (${pipeline.cronExpression})`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{t('stepsCount', { count: pipeline.steps.length })}</span>
                    <span>&middot;</span>
                    <span>{t('updated', { date: new Date(pipeline.updatedAt).toLocaleDateString() })}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
