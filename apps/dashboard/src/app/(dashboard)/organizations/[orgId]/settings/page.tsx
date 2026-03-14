'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { createOrgSchema, type CreateOrgInput } from '@/lib/validations/organization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import type { Organization } from '@/types';

const ORG_API_URL = process.env.NEXT_PUBLIC_ORG_API_URL || 'http://localhost:3002';

export default function OrgSettingsPage() {
  const t = useTranslations('orgSettings');
  const tc = useTranslations('common');
  const router = useRouter();
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const { data: session } = useSession();
  const [org, setOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const fetchOrg = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`${ORG_API_URL}/organizations/${orgId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setOrg(data);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [orgId, token]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateOrgInput>({
    resolver: zodResolver(createOrgSchema),
  });

  useEffect(() => {
    if (org) {
      reset({ name: org.name });
    }
  }, [org, reset]);

  async function onUpdate(data: CreateOrgInput) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${ORG_API_URL}/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: t('failedToUpdate') }));
        setError(body.message || t('failedToUpdate'));
        return;
      }

      const updated = await res.json();
      setOrg(updated);
      setSuccess(t('updateSuccess'));
    } catch {
      setError(tc('somethingWentWrong'));
    } finally {
      setIsSaving(false);
    }
  }

  async function onDelete() {
    if (confirmDelete !== org?.name) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`${ORG_API_URL}/organizations/${orgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (res.ok || res.status === 204) {
        router.push('/organizations');
        router.refresh();
      } else {
        setError(t('failedToDelete'));
      }
    } catch {
      setError(tc('somethingWentWrong'));
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

  if (!org) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('orgNotFound')}</p>
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
          <form id="update-org-form" onSubmit={handleSubmit(onUpdate)} className="space-y-4">
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
          </form>
        </CardContent>
        <CardFooter>
          <Button type="submit" form="update-org-form" disabled={isSaving}>
            {isSaving ? tc('saving') : tc('save')}
          </Button>
        </CardFooter>
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
              {tc('type')} <span className="font-semibold">{org.name}</span> {tc('toConfirm')}
            </Label>
            <Input
              id="confirmDelete"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={org.name}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={confirmDelete !== org.name || isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? tc('deleting') : t('deleteButton')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
