'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  Building2,
  FolderGit2,
  Play,
  Bell,
  ChevronRight,
  CheckCircle2,
  Circle,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import { useOrgStore } from '@/lib/stores/org-store';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import type { Organization, Project } from '@/types';

const ORG_API_URL = process.env.NEXT_PUBLIC_ORG_API_URL || 'http://localhost:3002';
const PROJECT_API_URL = process.env.NEXT_PUBLIC_PROJECT_API_URL || 'http://localhost:3003';
const PIPELINE_API_URL = process.env.NEXT_PUBLIC_PIPELINE_API_URL || 'http://localhost:3004';

interface StepStatus {
  hasOrgs: boolean;
  hasProjects: boolean;
  hasPipelines: boolean;
  orgCount: number;
  projectCount: number;
  pipelineCount: number;
}

export default function DashboardHomePage() {
  const { data: session } = useSession();
  const { currentOrgId } = useOrgStore();
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const tNav = useTranslations('nav');
  const [status, setStatus] = useState<StepStatus>({
    hasOrgs: false,
    hasProjects: false,
    hasPipelines: false,
    orgCount: 0,
    projectCount: 0,
    pipelineCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const fetchStatus = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const orgRes = await fetch(`${ORG_API_URL}/organizations`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const orgs: Organization[] = orgRes.ok ? await orgRes.json() : [];

      let projects: Project[] = [];
      let pipelineCount = 0;

      if (currentOrgId) {
        const projRes = await fetch(`${PROJECT_API_URL}/projects?orgId=${currentOrgId}`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        projects = projRes.ok ? await projRes.json() : [];

        if (projects.length > 0) {
          const pipRes = await fetch(`${PIPELINE_API_URL}/pipelines?projectId=${projects[0].id}`, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          if (pipRes.ok) {
            const pipelines = await pipRes.json();
            pipelineCount = pipelines.length;
          }
        }
      }

      setStatus({
        hasOrgs: orgs.length > 0,
        hasProjects: projects.length > 0,
        hasPipelines: pipelineCount > 0,
        orgCount: orgs.length,
        projectCount: projects.length,
        pipelineCount,
      });
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [token, currentOrgId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const completedSteps = [status.hasOrgs, status.hasProjects, status.hasPipelines].filter(Boolean).length;

  const steps = [
    {
      number: 1,
      title: t('step1Title'),
      description: t('step1Desc'),
      href: '/organizations/new',
      buttonText: t('createOrganization'),
      completed: status.hasOrgs,
      detail: status.hasOrgs ? t('step1Detail', { count: status.orgCount }) : null,
      icon: Building2,
    },
    {
      number: 2,
      title: t('step2Title'),
      description: t('step2Desc'),
      href: '/projects/new',
      buttonText: t('addProject'),
      completed: status.hasProjects,
      detail: status.hasProjects ? t('step2Detail', { count: status.projectCount }) : null,
      icon: FolderGit2,
      disabled: !status.hasOrgs,
    },
    {
      number: 3,
      title: t('step3Title'),
      description: t('step3Desc'),
      href: status.hasProjects ? '/projects' : '#',
      buttonText: t('setupPipeline'),
      completed: status.hasPipelines,
      detail: status.hasPipelines ? t('step3Detail', { count: status.pipelineCount }) : null,
      icon: Play,
      disabled: !status.hasProjects,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('welcome')}</h2>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <p className="text-muted-foreground">{tc('loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t('welcome')}</h2>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium">{t('setupProgress')}</p>
            <span className="text-sm text-muted-foreground">{t('stepsCompleted', { completed: completedSteps })}</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all duration-500"
              style={{ width: `${(completedSteps / 3) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {steps.map((step) => (
          <Card
            key={step.number}
            className={step.completed ? 'border-primary/30 bg-primary/5' : ''}
          >
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex-shrink-0 mt-0.5">
                {step.completed ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <step.icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">
                    {t('step', { number: step.number })}: {step.title}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                {step.detail && (
                  <p className="text-sm text-primary mt-1">{step.detail}</p>
                )}
              </div>
              <div className="flex-shrink-0">
                {step.completed ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={step.href}>
                      {tc('view')} <ChevronRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" asChild disabled={step.disabled}>
                    <Link href={step.disabled ? '#' : step.href}>
                      {step.buttonText} <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            {t('quickTips')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold dark:bg-blue-900 dark:text-blue-300">{num}</span>
              <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t.raw(`tip${num}`) }} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/organizations" className="block">
          <Card className="transition-colors hover:bg-accent/50 h-full">
            <CardContent className="flex items-center gap-3 pt-6">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{tNav('organizations')}</p>
                <p className="text-xs text-muted-foreground">{t('manageTeams')}</p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/projects" className="block">
          <Card className="transition-colors hover:bg-accent/50 h-full">
            <CardContent className="flex items-center gap-3 pt-6">
              <FolderGit2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{tNav('projects')}</p>
                <p className="text-xs text-muted-foreground">{t('viewRepositories')}</p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/settings/notifications" className="block">
          <Card className="transition-colors hover:bg-accent/50 h-full">
            <CardContent className="flex items-center gap-3 pt-6">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{tNav('notifications')}</p>
                <p className="text-xs text-muted-foreground">{t('configureAlerts')}</p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
