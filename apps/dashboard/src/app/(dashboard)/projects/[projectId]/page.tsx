import Link from 'next/link';
import { GitBranch, Settings, Webhook, Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getProject } from '@/lib/api/projects';
import { getPipelines } from '@/lib/api/pipelines';
import type { Project, Pipeline } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ProviderIcon } from '@/components/shared/provider-icon';

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const t = await getTranslations('projectDetail');
  const tc = await getTranslations('common');

  let project: Project | null = null;
  let pipelines: Pipeline[] = [];
  try {
    [project, pipelines] = await Promise.all([
      getProject(projectId),
      getPipelines(projectId),
    ]);
  } catch {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">{t('notFound')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('notFoundDesc')}
        </p>
        <Button asChild className="mt-4">
          <Link href="/projects">{t('backToProjects')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ProviderIcon provider={project.repoProvider} className="h-5 w-5" />
            <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
          </div>
          <p className="text-muted-foreground">{project.repoUrl}</p>
        </div>
        <Badge variant={project.webhookActive ? 'default' : 'secondary'}>
          <Webhook className="mr-1 h-3 w-3" />
          {project.webhookActive ? tc('active') : tc('inactive')}
        </Badge>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('repository')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <span>{project.defaultBranch}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Created {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('pipelines')}</CardDescription>
            <CardTitle className="text-4xl">{pipelines.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {pipelines.filter((p) => p.enabled).length} {tc('active').toLowerCase()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('quickActions')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${projectId}/pipelines`}>
                <Plus className="mr-2 h-4 w-4" />
                {t('pipelines')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${projectId}/settings`}>
                <Settings className="mr-2 h-4 w-4" />
                {tc('settings')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {pipelines.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-sm font-medium">{t('nextStep')}</p>
            <p className="mt-1 text-xs text-muted-foreground text-center max-w-md">
              {t('nextStepDesc')}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={`/projects/${projectId}/pipelines/new`}>
                <Plus className="mr-2 h-4 w-4" />
                {t('createPipeline')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {pipelines.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">{t('pipelines')}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {pipelines.map((pipeline) => (
              <Link key={pipeline.id} href={`/projects/${projectId}/pipelines/${pipeline.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{pipeline.name}</CardTitle>
                      <Badge variant={pipeline.enabled ? 'default' : 'secondary'}>
                        {pipeline.enabled ? tc('enabled') : tc('disabled')}
                      </Badge>
                    </div>
                    <CardDescription>
                      {pipeline.triggerType} &middot; {pipeline.steps.length} {tc('steps').toLowerCase()}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
