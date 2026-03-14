'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Sparkles, TestTube, Bug, RotateCcw, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { GenerationTypeBadge } from '@/components/shared/generation-type-badge';
import { getGenerations, getGenerationStats } from '@/lib/api/ai';
import type { AIGeneration, GenerationStats } from '@/types';

export default function AIHubPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: session } = useSession();
  const t = useTranslations();
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [generations, setGenerations] = useState<AIGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  useEffect(() => {
    if (!token) return;
    async function load() {
      try {
        const [statsData, generationsData] = await Promise.all([
          getGenerationStats(projectId, token),
          getGenerations(projectId, undefined, token),
        ]);
        setStats(statsData);
        setGenerations(generationsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('aiHub.failedToLoad'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, token, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">{t('aiHub.failedToLoad')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6" />
        <h2 className="text-3xl font-bold tracking-tight">{t('aiHub.title')}</h2>
      </div>

      <Separator />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('aiHub.totalGenerations')}</CardDescription>
            <CardTitle className="text-4xl">{stats?.total ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t('aiHub.totalGenerationsDesc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('aiHub.acceptanceRate')}</CardDescription>
            <CardTitle className="text-4xl">
              {stats ? `${Math.round(stats.acceptanceRate * 100)}%` : '0%'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t('aiHub.acceptanceRateDesc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('aiHub.tokensUsed')}</CardDescription>
            <CardTitle className="text-4xl">
              {stats?.totalTokens?.toLocaleString() ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t('aiHub.tokensUsedDesc')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">{t('aiHub.quickActions')}</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4">
            <Link href={`/projects/${projectId}/ai/generate?type=TEST_GEN`}>
              <TestTube className="h-6 w-6 text-purple-600" />
              <span>{t('aiHub.generateTests')}</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4">
            <Link href={`/projects/${projectId}/ai/generate?type=BUG_DETECT`}>
              <Bug className="h-6 w-6 text-red-600" />
              <span>{t('aiHub.detectBugs')}</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4">
            <Link href={`/projects/${projectId}/ai/generate?type=FLAKY_DETECT`}>
              <RotateCcw className="h-6 w-6 text-yellow-600" />
              <span>{t('aiHub.findFlakyTests')}</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col gap-2 py-4">
            <Link href={`/projects/${projectId}/ai/generate?type=COVERAGE_ADVICE`}>
              <ShieldCheck className="h-6 w-6 text-blue-600" />
              <span>{t('aiHub.coverageAdvice')}</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Recent Generations */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">{t('aiHub.recentGenerations')}</h3>
        {generations.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('aiHub.noGenerationsYet')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {generations.slice(0, 20).map((gen) => (
              <Link key={gen.id} href={`/projects/${projectId}/ai/${gen.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <GenerationTypeBadge type={gen.type} />
                      <div>
                        <p className="text-sm font-medium">
                          {gen.model}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(gen.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {gen.tokensUsed.toLocaleString()} {t('common.tokens')}
                      </span>
                      {gen.accepted === true && (
                        <Badge className="bg-green-100 text-green-700 border-green-200" variant="outline">
                          {t('common.accepted')}
                        </Badge>
                      )}
                      {gen.accepted === false && (
                        <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">
                          {t('common.rejected')}
                        </Badge>
                      )}
                      {gen.accepted === null && (
                        <Badge className="bg-gray-100 text-gray-600 border-gray-200" variant="outline">
                          {t('common.pending')}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
