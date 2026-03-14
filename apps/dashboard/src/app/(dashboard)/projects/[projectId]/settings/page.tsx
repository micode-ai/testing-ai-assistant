'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2, Webhook } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { updateProjectSchema, type UpdateProjectInput } from '@/lib/validations/project';
import { getProject, updateProject, deleteProject, connectWebhook, disconnectWebhook } from '@/lib/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import type { Project } from '@/types';

export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { data: session } = useSession();
  const t = useTranslations('projectSettings');
  const tc = useTranslations('common');
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingWebhook, setIsTogglingWebhook] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const fetchProject = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await getProject(projectId, token);
      setProject(data);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateProjectInput>({
    resolver: zodResolver(updateProjectSchema),
  });

  useEffect(() => {
    if (project) {
      reset({ name: project.name, repoUrl: project.repoUrl, defaultBranch: project.defaultBranch });
    }
  }, [project, reset]);

  async function onUpdate(data: UpdateProjectInput) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateProject(projectId, data, token);
      setProject(updated);
      setSuccess(t('updateSuccess'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToUpdate'));
    } finally {
      setIsSaving(false);
    }
  }

  async function onToggleWebhook() {
    if (!project) return;
    setIsTogglingWebhook(true);
    setError(null);

    try {
      const updated = project.webhookActive
        ? await disconnectWebhook(projectId, token)
        : await connectWebhook(projectId, token);
      setProject(updated);
      setSuccess(updated.webhookActive ? t('webhookConnected') : t('webhookDisconnected'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedWebhook'));
    } finally {
      setIsTogglingWebhook(false);
    }
  }

  async function onDelete() {
    if (confirmDelete !== project?.name) return;
    setIsDeleting(true);

    try {
      await deleteProject(projectId, token);
      router.push('/projects');
      router.refresh();
    } catch {
      setError(t('failedToDelete'));
    } finally {
      setIsDeleting(false);
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

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('notFound')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('general')}</CardTitle>
          <CardDescription>{t('generalDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="update-project-form" onSubmit={handleSubmit(onUpdate)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">
                {success}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">{t('nameLabel')}</Label>
              <Input id="name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="repoUrl">{t('repoUrlLabel')}</Label>
              <Input id="repoUrl" {...register('repoUrl')} />
              {errors.repoUrl && (
                <p className="text-sm text-destructive">{errors.repoUrl.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultBranch">{t('branchLabel')}</Label>
              <Input id="defaultBranch" {...register('defaultBranch')} />
              {errors.defaultBranch && (
                <p className="text-sm text-destructive">{errors.defaultBranch.message}</p>
              )}
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <Button type="submit" form="update-project-form" disabled={isSaving}>
            {isSaving ? tc('saving') : tc('save')}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('webhook')}</CardTitle>
          <CardDescription>
            {t('webhookDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Webhook className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t('webhookStatus')}</p>
              <Badge variant={project.webhookActive ? 'default' : 'secondary'}>
                {project.webhookActive ? tc('active') : tc('inactive')}
              </Badge>
            </div>
          </div>
          <Button
            variant={project.webhookActive ? 'outline' : 'default'}
            onClick={onToggleWebhook}
            disabled={isTogglingWebhook}
          >
            {isTogglingWebhook
              ? t('processing')
              : project.webhookActive
                ? t('disconnect')
                : t('connect')}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">{tc('dangerZone')}</CardTitle>
          <CardDescription>
            {t('deleteDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirmDelete">
              {tc('type')} <span className="font-semibold">{project.name}</span> {tc('toConfirm')}
            </Label>
            <Input
              id="confirmDelete"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={project.name}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={confirmDelete !== project.name || isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? tc('deleting') : t('deleteButton')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
