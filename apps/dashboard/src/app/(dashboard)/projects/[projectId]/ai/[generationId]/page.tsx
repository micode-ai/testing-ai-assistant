'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Loader2, Check, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { GenerationTypeBadge } from '@/components/shared/generation-type-badge';
import { getGeneration, submitFeedback } from '@/lib/api/ai';
import { PageSkeleton } from '@/components/shared/page-skeleton';
import type { AIGeneration } from '@/types';

export default function GenerationDetailPage() {
  const { projectId, generationId } = useParams<{
    projectId: string;
    generationId: string;
  }>();
  const { data: session } = useSession();
  const t = useTranslations();
  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  const [generation, setGeneration] = useState<AIGeneration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (!token) return;
    async function load() {
      try {
        const data = await getGeneration(generationId, token);
        setGeneration(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load generation');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [generationId, token]);

  async function handleFeedback(accepted: boolean) {
    if (!generation) return;
    setSubmittingFeedback(true);

    try {
      await submitFeedback(generation.id, accepted, feedbackText || undefined, token);
      setGeneration({ ...generation, accepted, feedback: feedbackText || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  }

  if (loading) {
    return <PageSkeleton cards={3} />;
  }

  if (error || !generation) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">{t('aiDetail.notFound')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error || t('aiDetail.notFoundDesc')}
        </p>
        <Button asChild className="mt-4">
          <Link href={`/projects/${projectId}/ai`}>{t('aiDetail.backToHub')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/projects/${projectId}/ai`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-bold tracking-tight">{t('aiDetail.title')}</h2>
          <GenerationTypeBadge type={generation.type} />
        </div>
      </div>

      <Separator />

      {/* Metadata */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('aiDetail.model')}</CardDescription>
            <CardTitle className="text-base">{generation.model}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('aiDetail.tokensUsed')}</CardDescription>
            <CardTitle className="text-base">
              {generation.tokensUsed.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('aiDetail.created')}</CardDescription>
            <CardTitle className="text-base">
              {new Date(generation.createdAt).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('aiDetail.status')}</CardDescription>
            <CardTitle className="text-base">
              {generation.accepted === true && (
                <Badge className="bg-green-100 text-green-700 border-green-200" variant="outline">
                  {t('common.accepted')}
                </Badge>
              )}
              {generation.accepted === false && (
                <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">
                  {t('common.rejected')}
                </Badge>
              )}
              {generation.accepted === null && (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200" variant="outline">
                  {t('aiDetail.pendingReview')}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Input Context */}
      <Card>
        <CardHeader>
          <CardTitle>{t('aiDetail.inputContext')}</CardTitle>
          <CardDescription>{t('aiDetail.inputContextDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-4 overflow-x-auto">
            <pre className="text-sm">
              <code>{JSON.stringify(generation.inputContext, null, 2)}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Output */}
      <Card>
        <CardHeader>
          <CardTitle>{t('aiDetail.output')}</CardTitle>
          <CardDescription>{t('aiDetail.outputDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-4 overflow-x-auto">
            <pre className="text-sm">
              <code>{generation.output}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Section */}
      {generation.accepted === null ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('aiDetail.review')}</CardTitle>
            <CardDescription>{t('aiDetail.reviewDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('aiDetail.feedbackLabel')}</label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={t('aiDetail.feedbackPlaceholder')}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={submittingFeedback}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleFeedback(true)}
                disabled={submittingFeedback}
                className="bg-green-600 hover:bg-green-700"
              >
                {submittingFeedback ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {t('common.accept')}
              </Button>
              <Button
                onClick={() => handleFeedback(false)}
                disabled={submittingFeedback}
                variant="destructive"
              >
                {submittingFeedback ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <X className="mr-2 h-4 w-4" />
                )}
                {t('common.reject')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        generation.feedback && (
          <Card>
            <CardHeader>
              <CardTitle>{t('aiDetail.feedbackTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{generation.feedback}</p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
