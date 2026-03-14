import Link from 'next/link';
import { Settings, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getOrganization, getMembers } from '@/lib/api/organizations';
import type { Organization, Membership } from '@/types';
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

interface OrgDetailPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function OrgDetailPage({ params }: OrgDetailPageProps) {
  const { orgId } = await params;
  const t = await getTranslations('orgDetail');
  const tc = await getTranslations('common');

  let org: Organization | null = null;
  let members: Membership[] = [];
  try {
    [org, members] = await Promise.all([
      getOrganization(orgId),
      getMembers(orgId),
    ]);
  } catch {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">{t('notFound')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('notFoundDesc')}
        </p>
        <Button asChild className="mt-4">
          <Link href="/organizations">{t('backToOrgs')}</Link>
        </Button>
      </div>
    );
  }

  const approvedMembers = members.filter((m) => m.status === 'APPROVED');
  const pendingMembers = members.filter((m) => m.status === 'PENDING');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{org.name}</h2>
          <p className="text-muted-foreground">{org.slug}</p>
        </div>
        <Badge variant={org.plan === 'PRO' ? 'default' : 'secondary'}>{org.plan}</Badge>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{tc('members')}</CardDescription>
            <CardTitle className="text-4xl">{approvedMembers.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {pendingMembers.length > 0
                ? `${pendingMembers.length} ${t('pendingRequests')}`
                : t('noPendingRequests')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('plan')}</CardDescription>
            <CardTitle className="text-4xl">{org.plan}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t('created')} {new Date(org.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('quickActions')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/organizations/${orgId}/members`}>
                <Users className="mr-2 h-4 w-4" />
                {t('manageMembers')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/organizations/${orgId}/settings`}>
                <Settings className="mr-2 h-4 w-4" />
                {tc('settings')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
