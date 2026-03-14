'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { Webhook } from 'lucide-react';
import { createProjectSchema, type CreateProjectInput } from '@/lib/validations/project';
import { createProject, connectWebhook } from '@/lib/api/projects';
import { useOrgStore } from '@/lib/stores/org-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

export default function NewProjectPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { currentOrgId } = useOrgStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const t = useTranslations('newProject');
  const tc = useTranslations('common');

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      defaultBranch: 'main',
      repoProvider: 'GITHUB',
    },
  });

  async function onSubmit(data: CreateProjectInput) {
    if (!currentOrgId) {
      setError(t('selectOrgFirst'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const project = await createProject(
        { ...data, orgId: currentOrgId },
        token,
      );
      setCreatedProjectId(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToCreate'));
    } finally {
      setIsLoading(false);
    }
  }

  async function onConnectWebhook() {
    if (!createdProjectId) return;
    setIsConnecting(true);
    try {
      await connectWebhook(createdProjectId, token);
      router.push(`/projects/${createdProjectId}`);
      router.refresh();
    } catch {
      router.push(`/projects/${createdProjectId}`);
      router.refresh();
    } finally {
      setIsConnecting(false);
    }
  }

  if (createdProjectId) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>{t('projectCreated')}</CardTitle>
            <CardDescription>{t('projectCreatedDesc')}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                router.push(`/projects/${createdProjectId}`);
                router.refresh();
              }}
            >
              {tc('skip')}
            </Button>
            <Button onClick={onConnectWebhook} disabled={isConnecting}>
              <Webhook className="mr-2 h-4 w-4" />
              {isConnecting ? t('connecting') : t('connectWebhook')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="create-project-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">{t('nameLabel')}</Label>
              <Input
                id="name"
                placeholder={t('namePlaceholder')}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="repoUrl">{t('repoUrlLabel')}</Label>
              <Input
                id="repoUrl"
                placeholder={t('repoUrlPlaceholder')}
                {...register('repoUrl')}
              />
              {errors.repoUrl && (
                <p className="text-sm text-destructive">{errors.repoUrl.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="repoProvider">{t('providerLabel')}</Label>
              <select
                id="repoProvider"
                {...register('repoProvider')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="GITHUB">GitHub</option>
                <option value="GITLAB">GitLab</option>
                <option value="BITBUCKET">Bitbucket</option>
              </select>
              {errors.repoProvider && (
                <p className="text-sm text-destructive">{errors.repoProvider.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultBranch">{t('branchLabel')}</Label>
              <Input
                id="defaultBranch"
                placeholder={t('branchPlaceholder')}
                {...register('defaultBranch')}
              />
              {errors.defaultBranch && (
                <p className="text-sm text-destructive">{errors.defaultBranch.message}</p>
              )}
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            {tc('cancel')}
          </Button>
          <Button type="submit" form="create-project-form" disabled={isLoading}>
            {isLoading ? tc('creating') : t('createButton')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
