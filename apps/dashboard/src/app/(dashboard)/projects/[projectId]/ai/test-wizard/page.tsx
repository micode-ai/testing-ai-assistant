'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Loader2,
  Sparkles,
  Search,
  ListChecks,
  CheckCircle2,
  Code2,
  GitBranch,
  AlertCircle,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
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
import {
  startTestGenSession,
  getTestGenSession,
  generateTestProposal,
  approveTestProposal,
  generateApprovedTests,
  updateGeneratedTests,
  commitTests,
} from '@/lib/api/ai';
import type {
  TestGenSession,
  TestGenSessionStatus,
  TestProposal,
  GeneratedTestFile,
  CommitResult,
} from '@/types';

const STEP_KEYS = ['analyze', 'propose', 'approve', 'generate', 'review', 'commit'] as const;
const STEP_ICONS = [Search, ListChecks, CheckCircle2, Code2, Code2, GitBranch];

type StepKey = (typeof STEP_KEYS)[number];

function statusToStep(status: TestGenSessionStatus): StepKey {
  switch (status) {
    case 'ANALYZING':
      return 'analyze';
    case 'PROPOSING':
      return 'propose';
    case 'AWAITING_APPROVAL':
      return 'approve';
    case 'GENERATING':
      return 'generate';
    case 'REVIEW':
      return 'review';
    case 'COMMITTING':
    case 'COMMITTED':
      return 'commit';
    default:
      return 'analyze';
  }
}

function getStepIndex(step: StepKey): number {
  return STEP_KEYS.indexOf(step);
}

export default function TestWizardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: authSession } = useSession();
  const t = useTranslations('testWizard');
  const locale = useLocale();
  const token = (authSession as unknown as Record<string, unknown>)
    ?.accessToken as string;

  const [currentStep, setCurrentStep] = useState<StepKey>('analyze');
  const [sessionData, setSessionData] = useState<TestGenSession | null>(null);
  const [proposal, setProposal] = useState<TestProposal | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [generatedTests, setGeneratedTests] = useState<GeneratedTestFile[]>([]);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState('');
  const [createPR, setCreatePR] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);

  const pollSession = useCallback(
    async (sessionId: string) => {
      setPolling(true);
      const maxAttempts = 200; // ~10 min at 3s intervals
      let attempts = 0;

      while (attempts < maxAttempts) {
        try {
          const updated = await getTestGenSession(sessionId, token);
          setSessionData(updated);

          if (updated.status === 'FAILED') {
            setError(updated.error || t('operationFailed'));
            setPolling(false);
            return updated;
          }

          // ANALYZING and GENERATING run in the background
          const waitingStatuses: TestGenSessionStatus[] = ['ANALYZING', 'GENERATING'];
          if (!waitingStatuses.includes(updated.status)) {
            setCurrentStep(statusToStep(updated.status));
            setPolling(false);
            return updated;
          }
        } catch {
          // Ignore polling errors, retry
        }

        await new Promise((r) => setTimeout(r, 3000));
        attempts++;
      }

      setError(t('operationTimedOut'));
      setPolling(false);
      return null;
    },
    [token, t],
  );

  async function handleStartAnalysis() {
    setLoading(true);
    setError(null);

    try {
      const newSession = await startTestGenSession(projectId, token, locale);
      setSessionData(newSession);

      const result = await pollSession(newSession.id);
      if (result && result.status === 'PROPOSING') {
        setCurrentStep('propose');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToStartAnalysis'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateProposal() {
    if (!sessionData) return;
    setLoading(true);
    setError(null);

    try {
      const result = await generateTestProposal(
        sessionData.id,
        focusArea || undefined,
        token,
        locale,
      );
      setProposal(result);
      setSelectedItems(new Set(result.items.map((i) => i.id)));
      setCurrentStep('approve');

      const updated = await getTestGenSession(sessionData.id, token);
      setSessionData(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToGenerateProposal'));
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveAndGenerate() {
    if (!sessionData || selectedItems.size === 0) return;
    setLoading(true);
    setError(null);

    try {
      await approveTestProposal(
        sessionData.id,
        Array.from(selectedItems),
        token,
      );

      // Switch to generate step immediately, then fire async generation
      setCurrentStep('generate');

      // Fire generation (backend runs it async now)
      generateApprovedTests(sessionData.id, token).catch(() => {
        // Error will be caught by polling via FAILED status
      });

      // Poll until REVIEW or FAILED
      const result = await pollSession(sessionData.id);
      if (result && result.status === 'REVIEW' && result.generatedTests) {
        setGeneratedTests(
          result.generatedTests as unknown as GeneratedTestFile[],
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToGenerateTests'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdits() {
    if (!sessionData) return;
    setLoading(true);
    try {
      await updateGeneratedTests(sessionData.id, generatedTests, token);
      setEditingIndex(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToSaveEdits'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!sessionData) return;
    setLoading(true);
    setError(null);

    try {
      const result = await commitTests(
        sessionData.id,
        { createPR },
        token,
      );
      setCommitResult(result);
      setCurrentStep('commit');

      const updated = await getTestGenSession(sessionData.id, token);
      setSessionData(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToCommit'));
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(id: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!proposal) return;
    setSelectedItems(new Set(proposal.items.map((i) => i.id)));
  }

  function deselectAll() {
    setSelectedItems(new Set());
  }

  function resetSession() {
    setSessionData(null);
    setProposal(null);
    setSelectedItems(new Set());
    setGeneratedTests([]);
    setCommitResult(null);
    setError(null);
    setCurrentStep('analyze');
  }

  const currentStepIndex = getStepIndex(currentStep);
  const isProcessing = loading || polling;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6" />
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
      </div>

      <Separator />

      {/* Step Indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEP_KEYS.map((key, index) => {
          const Icon = STEP_ICONS[index];
          const isActive = index === currentStepIndex;
          const isDone = index < currentStepIndex;

          return (
            <div key={key} className="flex items-center">
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isDone
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t(`steps.${key}`)}</span>
              </div>
              {index < STEP_KEYS.length - 1 && (
                <ChevronRight className="mx-1 h-4 w-4 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      {/* Token usage */}
      {sessionData && sessionData.totalTokensUsed > 0 && (
        <div className="text-sm text-muted-foreground">
          {t('totalTokensUsed', { count: sessionData.totalTokensUsed.toLocaleString() })}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-800 dark:text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p>{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 -ml-2"
              onClick={() => {
                setError(null);
                setCurrentStep('analyze');
              }}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {t('startOver')}
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Analyze — initial */}
      {currentStep === 'analyze' && !sessionData && (
        <Card>
          <CardHeader>
            <CardTitle>{t('analyzeTitle')}</CardTitle>
            <CardDescription>{t('analyzeDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('analyzeInfo')}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleStartAnalysis} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('analyzing')}
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  {t('startAnalysis')}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 1: Analyze — in progress */}
      {currentStep === 'analyze' && sessionData && (
        <Card>
          <CardHeader>
            <CardTitle>{t('analyzingTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm text-muted-foreground">{t('analyzingDesc')}</p>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Propose */}
      {currentStep === 'propose' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('proposeTitle')}</CardTitle>
            <CardDescription>{t('proposeDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('focusAreaLabel')}</label>
              <textarea
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                placeholder={t('focusAreaPlaceholder')}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={isProcessing}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleGenerateProposal} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('generatingProposal')}
                </>
              ) : (
                <>
                  <ListChecks className="mr-2 h-4 w-4" />
                  {t('generateProposal')}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Approve */}
      {currentStep === 'approve' && proposal && (
        <Card>
          <CardHeader>
            <CardTitle>{t('reviewProposalTitle')}</CardTitle>
            <CardDescription>{proposal.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('testsSelected', {
                  selected: selectedItems.size,
                  total: proposal.items.length,
                })}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  {t('selectAll')}
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  {t('deselectAll')}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {proposal.items.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                    selectedItems.has(item.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                  onClick={() => toggleItem(item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => toggleItem(item.id)}
                          className="rounded"
                        />
                        <span className="font-medium text-sm truncate">
                          {item.testFilePath}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground italic">
                        {item.rationale}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.priority === 'high'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : item.priority === 'medium'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        }`}
                      >
                        {item.priority}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t('testsInfo', {
                          type: item.testType,
                          count: item.estimatedTests,
                        })}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        &rarr; {item.targetFile}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleApproveAndGenerate}
              disabled={isProcessing || selectedItems.size === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('generatingTests')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t('approveAndGenerate', { count: selectedItems.size })}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Generate — in progress */}
      {currentStep === 'generate' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('generatingTestsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                {sessionData?.metadata?.currentTest && sessionData.metadata.totalTests ? (
                  <>
                    <p className="text-sm font-medium">
                      {t('generatingProgress', {
                        current: sessionData.metadata.currentTest,
                        total: sessionData.metadata.totalTests,
                      })}
                    </p>
                    {sessionData.metadata.currentFile && (
                      <p className="text-xs text-muted-foreground truncate">
                        {t('generatingFile', { file: sessionData.metadata.currentFile })}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('generatingTestsDesc', { count: selectedItems.size })}
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {sessionData?.metadata?.currentTest && sessionData.metadata.totalTests && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{
                      width: `${Math.round(((sessionData.metadata.currentTest - 1) / sessionData.metadata.totalTests) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {sessionData.metadata.currentTest - 1} / {sessionData.metadata.totalTests}
                </p>
              </div>
            )}

            {/* Token counter */}
            {sessionData && sessionData.totalTokensUsed > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('totalTokensUsed', { count: sessionData.totalTokensUsed.toLocaleString() })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review */}
      {currentStep === 'review' && generatedTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('reviewTitle')}</CardTitle>
            <CardDescription>{t('reviewDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedTests.map((test, index) => (
              <div key={test.path} className="rounded-lg border">
                <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/50">
                  <span className="font-mono text-sm">{test.path}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditingIndex(editingIndex === index ? null : index)
                    }
                  >
                    {editingIndex === index ? t('preview') : t('edit')}
                  </Button>
                </div>
                {editingIndex === index ? (
                  <textarea
                    value={test.content}
                    onChange={(e) => {
                      const updated = [...generatedTests];
                      updated[index] = { ...test, content: e.target.value };
                      setGeneratedTests(updated);
                    }}
                    className="w-full p-4 font-mono text-sm bg-background border-0 focus:outline-none min-h-[300px]"
                  />
                ) : (
                  <div className="p-4 overflow-x-auto">
                    <pre className="text-sm">
                      <code>{test.content}</code>
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
          <CardFooter className="flex flex-col gap-4 items-start">
            {editingIndex !== null && (
              <Button variant="outline" onClick={handleSaveEdits} disabled={loading}>
                {t('saveEdits')}
              </Button>
            )}
            <div className="flex items-center gap-4 w-full">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createPR}
                  onChange={(e) => setCreatePR(e.target.checked)}
                  className="rounded"
                />
                {t('createPullRequest')}
              </label>
              <Button
                onClick={handleCommit}
                disabled={isProcessing}
                className="ml-auto"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('committing')}
                  </>
                ) : (
                  <>
                    <GitBranch className="mr-2 h-4 w-4" />
                    {t('commitToRepository')}
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Step 6: Commit — success */}
      {currentStep === 'commit' && commitResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              {t('committedTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t('branch')}</span>
                <code className="rounded bg-muted px-2 py-0.5">
                  {commitResult.branchName}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{t('commit')}</span>
                <a
                  href={commitResult.commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-mono"
                >
                  {commitResult.commitSha.slice(0, 7)}
                </a>
              </div>
              {commitResult.pullRequestUrl && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('pullRequest')}</span>
                  <a
                    href={commitResult.pullRequestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {t('viewPR')}
                  </a>
                </div>
              )}
              {sessionData && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('totalTokens')}</span>
                  <span>{sessionData.totalTokensUsed.toLocaleString()}</span>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={resetSession}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t('startNewSession')}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
