'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Sparkles, TestTube, Bug, RotateCcw, ShieldCheck, Loader2, Wand2, CheckCircle2, Clock, AlertCircle, Square } from 'lucide-react';
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
import { getGenerations, getGenerationStats, getTestGenSessions, cancelSession } from '@/lib/api/ai';
import { PageSkeleton } from '@/components/shared/page-skeleton';
import type { AIGeneration, GenerationStats, TestGenSession, TestProposal } from '@/types';

export default function AIHubPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: session } = useSession();
  const t = useTranslations();
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [generations, setGenerations] = useState<AIGeneration[]>([]);
  const [sessions, setSessions] = useState<TestGenSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;

  useEffect(() => {
    if (!token) return;
    async function load() {
      try {
        const [statsData, generationsData, sessionsData] = await Promise.all([
          getGenerationStats(projectId, token),
          getGenerations(projectId, undefined, token),
          getTestGenSessions(projectId, token),
        ]);
        setStats(statsData);
        setGenerations(generationsData);
        setSessions(sessionsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('aiHub.failedToLoad'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, token, t]);

  if (loading) {
    return <PageSkeleton cards={4} />;
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
            <CardTitle className="text-4xl">{stats?.totalGenerations ?? 0}</CardTitle>
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
              {stats && stats.acceptedCount + stats.rejectedCount > 0
                ? `${Math.round((stats.acceptedCount / (stats.acceptedCount + stats.rejectedCount)) * 100)}%`
                : '0%'}
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
              {stats?.totalTokensUsed?.toLocaleString() ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t('aiHub.tokensUsedDesc')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Smart Test Generator */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Wand2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{t('testWizard.smartGenerator')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('testWizard.smartGeneratorDesc')}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={`/projects/${projectId}/ai/test-wizard`}>
              {t('testWizard.startWizard')}
            </Link>
          </Button>
        </CardContent>
      </Card>

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

      {/* Test Gen Sessions */}
      {sessions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">{t('testWizard.pastSessions')}</h3>
          <div className="space-y-2">
            {sessions.map((s) => {
              const proposalCount = (s.proposal as TestProposal | null)?.items?.length || 0;
              const generatedCount = s.generatedTests?.length || 0;
              const remaining = proposalCount - generatedCount;

              const statusIcon = s.status === 'COMMITTED'
                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : s.status === 'FAILED'
                  ? <AlertCircle className="h-4 w-4 text-red-600" />
                  : ['ANALYZING', 'GENERATING', 'VALIDATING', 'PROPOSING'].includes(s.status)
                    ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    : <Clock className="h-4 w-4 text-muted-foreground" />;

              const isActive = !['COMMITTED', 'CANCELLED', 'FAILED'].includes(s.status);

              return (
                <Card key={s.id} className="transition-colors hover:bg-accent/50">
                  <CardContent className="flex items-center justify-between py-4">
                    <Link
                      href={`/projects/${projectId}/ai/test-wizard?session=${s.id}`}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      {statusIcon}
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(s.createdAt).toLocaleDateString()} — {s.status}
                        </p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{s.totalTokensUsed.toLocaleString()} {t('common.tokens')}</span>
                          {generatedCount > 0 && (
                            <span>{t('testWizard.generatedItems', { count: generatedCount })}</span>
                          )}
                          {remaining > 0 && (
                            <span className="text-yellow-600">{t('testWizard.remainingItems', { count: remaining })}</span>
                          )}
                          {s.commitSha && (
                            <span className="text-green-600 font-mono">{s.commitSha.slice(0, 7)}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={async (e) => {
                            e.preventDefault();
                            await cancelSession(s.id, token);
                            const updated = await getTestGenSessions(projectId, token);
                            setSessions(updated);
                          }}
                        >
                          <Square className="h-3 w-3" />
                        </Button>
                      )}
                      <Badge variant="outline">
                        {s.status === 'COMMITTED' ? t('testWizard.steps.commit')
                          : s.status === 'CANCELLED' ? t('testWizard.cancelSession')
                          : s.status === 'REVIEW' ? t('testWizard.steps.review')
                          : s.status === 'AWAITING_APPROVAL' ? t('testWizard.steps.approve')
                          : s.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

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
