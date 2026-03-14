'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { UserPlus, ShieldCheck, ShieldX, Check, X } from 'lucide-react';
import { inviteMemberSchema, type InviteMemberInput } from '@/lib/validations/organization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Membership } from '@/types';

const ORG_API_URL = process.env.NEXT_PUBLIC_ORG_API_URL || 'http://localhost:3002';

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  ADMIN: 'default',
  MEMBER: 'secondary',
  VIEWER: 'outline',
};

export default function MembersPage() {
  const t = useTranslations('orgMembers');
  const tc = useTranslations('common');
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const { data: session } = useSession();
  const [members, setMembers] = useState<Membership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const fetchMembers = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`${ORG_API_URL}/organizations/${orgId}/members`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setMembers(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [orgId, token]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { role: 'MEMBER' },
  });

  async function onInvite(data: InviteMemberInput) {
    setActionLoading('invite');
    try {
      const res = await fetch(`${ORG_API_URL}/organizations/${orgId}/members/invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setInviteOpen(false);
        reset();
        await fetchMembers();
      }
    } catch {
      // Silently fail
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApprove(memberId: string) {
    setActionLoading(memberId);
    try {
      await fetch(`${ORG_API_URL}/organizations/${orgId}/members/${memberId}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      await fetchMembers();
    } catch {
      // Silently fail
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(memberId: string) {
    setActionLoading(memberId);
    try {
      await fetch(`${ORG_API_URL}/organizations/${orgId}/members/${memberId}/reject`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      await fetchMembers();
    } catch {
      // Silently fail
    } finally {
      setActionLoading(null);
    }
  }

  async function handleChangeRole(memberId: string, role: string) {
    setActionLoading(memberId);
    try {
      await fetch(`${ORG_API_URL}/organizations/${orgId}/members/${memberId}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      await fetchMembers();
    } catch {
      // Silently fail
    } finally {
      setActionLoading(null);
    }
  }

  const approvedMembers = members.filter((m) => m.status === 'APPROVED');
  const pendingMembers = members.filter((m) => m.status === 'PENDING');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
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
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              {t('inviteMember')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('inviteMember')}</DialogTitle>
              <DialogDescription>
                {t('inviteDesc')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onInvite)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">{t('userId')}</Label>
                <Input id="userId" placeholder={t('userIdPlaceholder')} {...register('userId')} />
                {errors.userId && (
                  <p className="text-sm text-destructive">{errors.userId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">{t('role')}</Label>
                <select
                  id="role"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('role')}
                >
                  <option value="MEMBER">{t('roleMember')}</option>
                  <option value="ADMIN">{t('roleAdmin')}</option>
                  <option value="VIEWER">{t('roleViewer')}</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={actionLoading === 'invite'}>
                  {actionLoading === 'invite' ? t('inviting') : t('sendInvite')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {pendingMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('pendingRequests')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{tc('user')}: {member.userId}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('requested')} {new Date(member.requestedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApprove(member.id)}
                      disabled={actionLoading === member.id}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      {t('approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(member.id)}
                      disabled={actionLoading === member.id}
                    >
                      <X className="mr-1 h-3 w-3" />
                      {tc('reject')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('activeMembers')}</CardTitle>
        </CardHeader>
        <CardContent>
          {approvedMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noActiveMembers')}</p>
          ) : (
            <div className="space-y-3">
              {approvedMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{tc('user')}: {member.userId}</p>
                      <Badge variant={roleBadgeVariant[member.role] ?? 'secondary'}>
                        {member.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {member.role !== 'ADMIN' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleChangeRole(member.id, 'ADMIN')}
                        disabled={actionLoading === member.id}
                        title={t('promoteToAdmin')}
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </Button>
                    )}
                    {member.role !== 'MEMBER' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleChangeRole(member.id, 'MEMBER')}
                        disabled={actionLoading === member.id}
                        title={t('setAsMember')}
                      >
                        <ShieldX className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
