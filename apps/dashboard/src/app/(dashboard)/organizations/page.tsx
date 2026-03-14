'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Building2, Plus, Users, Trash2 } from 'lucide-react';
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
import type { Organization } from '@/types';

const ORG_API_URL = process.env.NEXT_PUBLIC_ORG_API_URL || 'http://localhost:3002';

const planVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  FREE: 'secondary',
  PRO: 'default',
  ENTERPRISE: 'outline',
};

export default function OrganizationsPage() {
  const { data: session } = useSession();
  const { currentOrgId, setCurrentOrgId } = useOrgStore();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const t = useTranslations('organizations');
  const tc = useTranslations('common');

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const fetchOrgs = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`${ORG_API_URL}/organizations`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setOrganizations(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  async function handleDelete(orgId: string, orgName: string) {
    if (!confirm(t('deleteConfirm', { name: orgName }))) {
      return;
    }
    setDeletingId(orgId);
    try {
      const res = await fetch(`${ORG_API_URL}/organizations/${orgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok || res.status === 204) {
        setOrganizations((prev) => prev.filter((o) => o.id !== orgId));
        if (currentOrgId === orgId) {
          setCurrentOrgId(null);
        }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/organizations/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('newOrganization')}
          </Link>
        </Button>
      </div>

      {organizations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">{t('noOrgsYet')}</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
              {t('noOrgsDesc')}
            </p>
            <Button asChild className="mt-4">
              <Link href="/organizations/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('createOrganization')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <Card key={org.id} className="transition-colors hover:bg-accent/50">
              <Link href={`/organizations/${org.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{org.name}</CardTitle>
                    <Badge variant={planVariant[org.plan] ?? 'secondary'}>{org.plan}</Badge>
                  </div>
                  <CardDescription>{org.slug}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{t('members', { count: org.memberCount ?? 0 })}</span>
                  </div>
                </CardContent>
              </Link>
              <CardContent className="pt-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(org.id, org.name)}
                  disabled={deletingId === org.id}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {deletingId === org.id ? tc('deleting') : tc('delete')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
