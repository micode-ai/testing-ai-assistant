'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  Building2, Plus, Users, Trash2, Settings, ArrowRight, Crown, Zap, Shield,
} from 'lucide-react';
import { useOrgStore } from '@/lib/stores/org-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageSkeleton } from '@/components/shared/page-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import type { Organization } from '@/types';

const ORG_API_URL = process.env.NEXT_PUBLIC_ORG_API_URL || 'http://localhost:3002';

const planConfig: Record<string, { variant: 'default' | 'secondary' | 'outline'; icon: typeof Crown; color: string }> = {
  FREE: { variant: 'secondary', icon: Shield, color: 'text-muted-foreground' },
  PRO: { variant: 'default', icon: Zap, color: 'text-status-running' },
  ENTERPRISE: { variant: 'outline', icon: Crown, color: 'text-status-warning' },
};

export default function OrganizationsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { currentOrgId, setCurrentOrgId } = useOrgStore();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const t = useTranslations('organizations');
  const tc = useTranslations('common');

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const fetchOrgs = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`${ORG_API_URL}/organizations`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setOrganizations(await res.json());
      } else {
        setError(`Failed to load organizations (HTTP ${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  async function handleDelete(orgId: string, orgName: string) {
    if (!confirm(t('deleteConfirm', { name: orgName }))) return;
    setDeletingId(orgId);
    try {
      const res = await fetch(`${ORG_API_URL}/organizations/${orgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok || res.status === 204) {
        setOrganizations((prev) => prev.filter((o) => o.id !== orgId));
        if (currentOrgId === orgId) setCurrentOrgId(null);
      }
    } catch {
      // Best-effort
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) return <PageSkeleton cards={3} />;
  if (error) return <ErrorAlert message={error} onRetry={fetchOrgs} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/organizations/new">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('newOrganization')}
          </Link>
        </Button>
      </div>

      {/* Empty state */}
      {organizations.length === 0 && (
        <EmptyState
          icon={Building2}
          title={t('noOrgsYet')}
          description={t('noOrgsDesc')}
          actionLabel={t('createOrganization')}
          onAction={() => {}}
        />
      )}

      {/* Org grid */}
      {organizations.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => {
            const plan = planConfig[org.plan] ?? planConfig.FREE;
            const PlanIcon = plan.icon;
            const isActive = currentOrgId === org.id;

            return (
              <Card
                key={org.id}
                className={`group cursor-pointer hover:shadow-md transition-all ${isActive ? 'ring-2 ring-primary' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setCurrentOrgId(org.id);
                  router.push(`/organizations/${org.id}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setCurrentOrgId(org.id);
                    router.push(`/organizations/${org.id}`);
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <CardTitle className="text-lg leading-tight">{org.name}</CardTitle>
                        <CardDescription className="font-mono text-xs">{org.slug}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={plan.variant} className="shrink-0">
                      <PlanIcon className={`mr-1 h-3 w-3 ${plan.color}`} aria-hidden="true" />
                      {org.plan}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pb-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <Link
                      href={`/organizations/${org.id}/members`}
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Users className="h-4 w-4" aria-hidden="true" />
                      <span>{t('members', { count: org.memberCount ?? 0 })}</span>
                    </Link>
                    <span className="text-xs">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>

                <Separator />

                <CardFooter className="pt-3 pb-3 flex items-center justify-between">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link href={`/organizations/${org.id}/settings`}>
                        <Settings className="mr-1 h-3 w-3" aria-hidden="true" />
                        {tc('settings')}
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); handleDelete(org.id, org.name); }}
                      disabled={deletingId === org.id}
                      aria-label={`${tc('delete')} ${org.name}`}
                    >
                      <Trash2 className="mr-1 h-3 w-3" aria-hidden="true" />
                      {deletingId === org.id ? tc('deleting') : tc('delete')}
                    </Button>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true" />
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
