'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Trash2, Github, GitlabIcon, Check, Plus, X } from 'lucide-react';
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

  // Integrations state
  const [providerTokens, setProviderTokens] = useState<Array<{
    id: string; provider: string; label: string | null; hasToken: boolean;
  }>>([]);
  const [addingProvider, setAddingProvider] = useState<string | null>(null);
  const [newToken, setNewToken] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const fetchTokens = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${ORG_API_URL}/organizations/${orgId}/provider-tokens`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProviderTokens(await res.json());
      }
    } catch { /* ignore */ }
  }, [orgId, token]);

  useEffect(() => {
    fetchOrg();
    fetchTokens();
  }, [fetchOrg, fetchTokens]);

  async function handleSaveToken(provider: string) {
    if (!newToken.trim()) return;
    setSavingToken(true);
    setTokenMessage(null);
    try {
      const res = await fetch(`${ORG_API_URL}/organizations/${orgId}/provider-tokens`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, token: newToken.trim(), label: newLabel.trim() || undefined }),
      });
      if (res.ok) {
        setTokenMessage({ type: 'success', text: t('tokenSaved') });
        setAddingProvider(null);
        setNewToken('');
        setNewLabel('');
        await fetchTokens();
      } else {
        setTokenMessage({ type: 'error', text: t('failedToSaveToken') });
      }
    } catch {
      setTokenMessage({ type: 'error', text: t('failedToSaveToken') });
    } finally {
      setSavingToken(false);
    }
  }

  async function handleRemoveToken(provider: string) {
    setTokenMessage(null);
    try {
      const res = await fetch(`${ORG_API_URL}/organizations/${orgId}/provider-tokens/${provider}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTokenMessage({ type: 'success', text: t('tokenRemoved') });
        await fetchTokens();
      } else {
        setTokenMessage({ type: 'error', text: t('failedToRemoveToken') });
      }
    } catch {
      setTokenMessage({ type: 'error', text: t('failedToRemoveToken') });
    }
  }

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

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>{t('integrations')}</CardTitle>
          <CardDescription>{t('integrationsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tokenMessage && (
            <div className={`rounded-md p-3 text-sm ${
              tokenMessage.type === 'success'
                ? 'bg-green-500/10 text-green-700'
                : 'bg-destructive/10 text-destructive'
            }`}>
              {tokenMessage.text}
            </div>
          )}

          {/* Provider list */}
          {(['GITHUB', 'GITLAB', 'BITBUCKET'] as const).map((provider) => {
            const existing = providerTokens.find((t) => t.provider === provider);
            const isAdding = addingProvider === provider;
            const Icon = provider === 'GITHUB' ? Github : provider === 'GITLAB' ? GitlabIcon : Github;
            const providerName = provider === 'GITHUB' ? 'GitHub' : provider === 'GITLAB' ? 'GitLab' : 'Bitbucket';

            return (
              <div key={provider} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <div>
                      <p className="font-medium text-sm">{providerName}</p>
                      {existing && (
                        <p className="text-xs text-muted-foreground">
                          {existing.label || t('tokenConnected')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {existing ? (
                      <>
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <Check className="h-3 w-3" />
                          {t('tokenConnected')}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveToken(provider)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAddingProvider(isAdding ? null : provider);
                            setNewToken('');
                            setNewLabel(existing.label || '');
                          }}
                        >
                          {isAdding ? tc('cancel') : t('addToken')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddingProvider(isAdding ? null : provider);
                          setNewToken('');
                          setNewLabel('');
                        }}
                      >
                        {isAdding ? tc('cancel') : <><Plus className="mr-1 h-3 w-3" /> {t('addToken')}</>}
                      </Button>
                    )}
                  </div>
                </div>

                {isAdding && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    {/* Provider-specific instructions */}
                    <div className="rounded-md bg-muted/50 p-3 space-y-1">
                      {provider === 'GITHUB' && (
                        <>
                          <p className="text-xs text-muted-foreground">{t('githubHint1')}</p>
                          <p className="text-xs text-muted-foreground">{t('githubHint2')}</p>
                          <p className="text-xs text-muted-foreground">{t('githubHint3')}</p>
                          <p className="text-xs text-muted-foreground">{t('githubHint4')}</p>
                          <p className="text-xs text-muted-foreground">{t('githubHint5')}</p>
                        </>
                      )}
                      {provider === 'GITLAB' && (
                        <>
                          <p className="text-xs text-muted-foreground">{t('gitlabHint1')}</p>
                          <p className="text-xs text-muted-foreground">{t('gitlabHint2')}</p>
                          <p className="text-xs text-muted-foreground">{t('gitlabHint3')}</p>
                          <p className="text-xs text-muted-foreground">{t('gitlabHint4')}</p>
                          <p className="text-xs text-muted-foreground">{t('gitlabHint5')}</p>
                        </>
                      )}
                      {provider === 'BITBUCKET' && (
                        <>
                          <p className="text-xs text-muted-foreground">{t('bitbucketHint1')}</p>
                          <p className="text-xs text-muted-foreground">{t('bitbucketHint2')}</p>
                          <p className="text-xs text-muted-foreground">{t('bitbucketHint3')}</p>
                          <p className="text-xs text-muted-foreground">{t('bitbucketHint4')}</p>
                        </>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label>{t('providerToken')}</Label>
                      <Input
                        type="password"
                        value={newToken}
                        onChange={(e) => setNewToken(e.target.value)}
                        placeholder={t('providerTokenPlaceholder')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('providerLabel')}</Label>
                      <Input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder={t('providerLabelPlaceholder')}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSaveToken(provider)}
                      disabled={savingToken || !newToken.trim()}
                    >
                      {savingToken ? tc('saving') : t('addToken')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
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
