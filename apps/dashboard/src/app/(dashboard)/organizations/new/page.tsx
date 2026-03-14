'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { createOrgSchema, type CreateOrgInput } from '@/lib/validations/organization';
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

const ORG_API_URL = process.env.NEXT_PUBLIC_ORG_API_URL || 'http://localhost:3002';

export default function NewOrganizationPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { setCurrentOrgId } = useOrgStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations('newOrg');
  const tc = useTranslations('common');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrgInput>({
    resolver: zodResolver(createOrgSchema),
  });

  async function onSubmit(data: CreateOrgInput) {
    setIsLoading(true);
    setError(null);

    try {
      const token = (session as unknown as Record<string, unknown>)?.accessToken as string;
      const res = await fetch(`${ORG_API_URL}/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: t('failedToCreate') }));
        setError(body.message || t('failedToCreate'));
        return;
      }

      const org = await res.json();
      setCurrentOrgId(org.id);
      router.push(`/organizations/${org.id}`);
      router.refresh();
    } catch {
      setError(tc('somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="create-org-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            {tc('cancel')}
          </Button>
          <Button type="submit" form="create-org-form" disabled={isLoading}>
            {isLoading ? tc('creating') : t('createButton')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
