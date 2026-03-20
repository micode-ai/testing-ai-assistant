'use client';

import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2, Sparkles, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { GenerationTypeBadge } from '@/components/shared/generation-type-badge';
import { BugReportView } from '@/components/shared/bug-report-view';
import { FlakyReportView } from '@/components/shared/flaky-report-view';
import { CoverageReportView } from '@/components/shared/coverage-report-view';
import { triggerGeneration, submitFeedback } from '@/lib/api/ai';
import type { AIGeneration, GenerationType } from '@/types';

export default function GeneratePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const locale = useLocale();
  const token = (session as unknown as Record<string, unknown>)?.accessToken as string;
  const initialType = (searchParams.get('type') as GenerationType) || 'TEST_GEN';

  const generationTypes: { value: GenerationType; label: string }[] = [
    { value: 'TEST_GEN', label: t('aiHub.generateTests') },
    { value: 'BUG_DETECT', label: t('aiHub.detectBugs') },
    { value: 'FLAKY_DETECT', label: t('aiHub.findFlakyTests') },
    { value: 'COVERAGE_ADVICE', label: t('aiHub.coverageAdvice') },
  ];

  const [type, setType] = useState<GenerationType>(initialType);
  const [commitSha, setCommitSha] = useState('');
  const [diff, setDiff] = useState('');
  const [testFramework, setTestFramework] = useState('jest');
  const [runId, setRunId] = useState('');
  const [testResults, setTestResults] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<AIGeneration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [showBugDetectAdvanced, setShowBugDetectAdvanced] = useState(false);

  function buildInputContext(): Record<string, unknown> {
    switch (type) {
      case 'TEST_GEN':
        return {
          ...(commitSha ? { commitSha } : {}),
          ...(diff ? { diff } : {}),
          testFramework,
        };
      case 'BUG_DETECT':
        if (testResults || runId) {
          return {
            locale,
            ...(runId ? { runId } : {}),
            ...(testResults ? { testResults } : {}),
          };
        }
        return { locale };
      case 'FLAKY_DETECT':
        return { locale };
      case 'COVERAGE_ADVICE':
        return { locale };
      default:
        return {};
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResult(null);
    setFeedbackSubmitted(false);

    try {
      const generation = await triggerGeneration({
        projectId,
        type,
        inputContext: buildInputContext(),
      }, token);
      setResult(generation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleFeedback(accepted: boolean) {
    if (!result) return;
    setSubmittingFeedback(true);

    try {
      await submitFeedback(result.id, accepted, feedbackText || undefined, token);
      setFeedbackSubmitted(true);
      setResult({ ...result, accepted, feedback: feedbackText || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6" />
        <h2 className="text-3xl font-bold tracking-tight">{t('aiGenerate.title')}</h2>
      </div>

      <Separator />

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t('aiGenerate.configTitle')}</CardTitle>
          <CardDescription>
            {t('aiGenerate.configDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('aiGenerate.generationType')}</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as GenerationType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={generating}
            >
              {generationTypes.map((gt) => (
                <option key={gt.value} value={gt.value}>
                  {gt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type-specific inputs */}
          {type === 'TEST_GEN' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('aiGenerate.commitSha')}</label>
                <input
                  type="text"
                  value={commitSha}
                  onChange={(e) => setCommitSha(e.target.value)}
                  placeholder={t('aiGenerate.commitShaPlaceholder')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={generating}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('aiGenerate.diff')}</label>
                <textarea
                  value={diff}
                  onChange={(e) => setDiff(e.target.value)}
                  placeholder={t('aiGenerate.diffPlaceholder')}
                  rows={6}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={generating}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('aiGenerate.testFramework')}</label>
                <select
                  value={testFramework}
                  onChange={(e) => setTestFramework(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={generating}
                >
                  <option value="jest">Jest</option>
                  <option value="vitest">Vitest</option>
                  <option value="mocha">Mocha</option>
                  <option value="pytest">Pytest</option>
                  <option value="junit">JUnit</option>
                </select>
              </div>
            </>
          )}

          {type === 'BUG_DETECT' && (
            <>
              <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
                {t('aiGenerate.bugDetectAutoNote')}
              </div>
              <button
                type="button"
                onClick={() => setShowBugDetectAdvanced(!showBugDetectAdvanced)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={generating}
              >
                {showBugDetectAdvanced ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {t('aiGenerate.advancedOverride')}
              </button>
              {showBugDetectAdvanced && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('aiGenerate.runId')}</label>
                    <input
                      type="text"
                      value={runId}
                      onChange={(e) => setRunId(e.target.value)}
                      placeholder={t('aiGenerate.runIdPlaceholder')}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={generating}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('aiGenerate.testResults')}</label>
                    <textarea
                      value={testResults}
                      onChange={(e) => setTestResults(e.target.value)}
                      placeholder={t('aiGenerate.testResultsPlaceholder')}
                      rows={6}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={generating}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {type === 'FLAKY_DETECT' && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
              {t('aiGenerate.flakyNote')}
            </div>
          )}

          {type === 'COVERAGE_ADVICE' && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
              {t('aiGenerate.coverageNote')}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('aiGenerate.generating')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {t('aiGenerate.generate')}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>{t('aiGenerate.result')}</CardTitle>
                <CardDescription>
                  {t('aiGenerate.model')}: {result.model} &middot; {result.tokensUsed.toLocaleString()} {t('common.tokens')}
                </CardDescription>
              </div>
              <GenerationTypeBadge type={result.type} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.type === 'BUG_DETECT' ? (
              <BugReportView output={result.output} />
            ) : result.type === 'FLAKY_DETECT' ? (
              <FlakyReportView output={result.output} />
            ) : result.type === 'COVERAGE_ADVICE' ? (
              <CoverageReportView output={result.output} />
            ) : (
              <div className="rounded-md bg-muted p-4 overflow-x-auto">
                <pre className="text-sm">
                  <code>{result.output}</code>
                </pre>
              </div>
            )}

            {/* Feedback Section */}
            {!feedbackSubmitted && result.accepted === null && (
              <div className="space-y-3">
                <Separator />
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('aiGenerate.feedback')}</label>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder={t('aiGenerate.feedbackPlaceholder')}
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
              </div>
            )}

            {/* Feedback submitted confirmation */}
            {feedbackSubmitted && (
              <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
                {result.accepted ? t('aiGenerate.feedbackAccepted') : t('aiGenerate.feedbackRejected')}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
