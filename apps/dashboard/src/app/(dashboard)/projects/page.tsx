'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { FolderGit2, Plus, Webhook, Trash2 } from 'lucide-react';
import { useOrgStore } from '@/lib/stores/org-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import type { Project } from '@/types';

const PROJECT_API_URL = process.env.NEXT_PUBLIC_PROJECT_API_URL || 'http://localhost:3003';

export default function ProjectsPage() {
  const { data: session } = useSession();
  const { currentOrgId } = useOrgStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const t = useTranslations('projects');
  const tc = useTranslations('common');

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const fetchProjects = useCallback(async () => {
    if (!token || !currentOrgId) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`${PROJECT_API_URL}/projects?orgId=${currentOrgId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setProjects(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [token, currentOrgId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleDelete(projectId: string, projectName: string) {
    if (!confirm(t('deleteConfirm', { name: projectName }))) return;
    setDeletingId(projectId);
    try {
      const res = await fetch(`${PROJECT_API_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok || res.status === 204) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      }
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <p className="text-muted-foreground">{tc('loading')}</p>
      </div>
    );
  }

  if (!currentOrgId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderGit2 className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">{t('noOrgSelected')}</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
              {t('noOrgDesc')}
            </p>
            <Button asChild className="mt-4">
              <Link href="/organizations/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('createOrganization')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('newProject')}
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderGit2 className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">{t('noProjectsYet')}</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
              {t('noProjectsDesc')}
            </p>
            <Button asChild className="mt-4">
              <Link href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('createProject')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="transition-colors hover:bg-accent/50">
              <Link href={`/projects/${project.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <Badge variant={project.webhookActive ? 'default' : 'secondary'}>
                      <Webhook className="mr-1 h-3 w-3" />
                      {project.webhookActive ? tc('active') : tc('inactive')}
                    </Badge>
                  </div>
                  <CardDescription className="truncate">{project.repoUrl}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{project.repoProvider}</span>
                    <span>{t('branch', { branch: project.defaultBranch })}</span>
                  </div>
                </CardContent>
              </Link>
              <CardContent className="pt-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(project.id, project.name)}
                  disabled={deletingId === project.id}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {deletingId === project.id ? tc('deleting') : tc('delete')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
