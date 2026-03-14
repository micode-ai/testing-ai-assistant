import { proxyActivities, ApplicationFailure } from '@temporalio/workflow';
import type { PipelineInput, StepResult, CoverageResult, CoverageDiff } from '../types';

// Activity interfaces for proxy
import type * as repositoryActivities from '../activities/repository.activities';
import type * as testRunnerActivities from '../activities/test-runner.activities';
import type * as securityActivities from '../activities/security.activities';
import type * as reportingActivities from '../activities/reporting.activities';
import type * as e2eActivities from '../activities/e2e.activities';
import type * as coverageActivities from '../activities/coverage.activities';
import type * as artifactActivities from '../activities/artifact.activities';
import type * as loadTestActivities from '../activities/load-test.activities';

const repository = proxyActivities<typeof repositoryActivities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3 },
});

const testRunner = proxyActivities<typeof testRunnerActivities>({
  startToCloseTimeout: '30 minutes',
  retry: { maximumAttempts: 2 },
  heartbeatTimeout: '2 minutes',
});

const security = proxyActivities<typeof securityActivities>({
  startToCloseTimeout: '15 minutes',
  retry: { maximumAttempts: 2 },
});

const reporting = proxyActivities<typeof reportingActivities>({
  startToCloseTimeout: '1 minute',
  retry: { maximumAttempts: 5 },
});

const e2e = proxyActivities<typeof e2eActivities>({
  startToCloseTimeout: '30 minutes',
  retry: { maximumAttempts: 2 },
  heartbeatTimeout: '2 minutes',
});

const coverage = proxyActivities<typeof coverageActivities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3 },
});

const artifacts = proxyActivities<typeof artifactActivities>({
  startToCloseTimeout: '10 minutes',
  retry: { maximumAttempts: 3 },
});

const loadTest = proxyActivities<typeof loadTestActivities>({
  startToCloseTimeout: '30 minutes',
  retry: { maximumAttempts: 2 },
  heartbeatTimeout: '2 minutes',
});

// Check types that can run in parallel (phase 1)
const PARALLEL_CHECK_TYPES = new Set(['unit', 'lint', 'sast', 'dep_audit', 'integration']);

// Check types that run sequentially after parallel phase
const SEQUENTIAL_CHECK_TYPES = new Set(['e2e', 'playwright_e2e', 'load', 'k6_load', 'dast', 'coverage']);

type ActivityRunner = (
  workspacePath: string,
  config: Record<string, unknown>
) => Promise<StepResult>;

/**
 * Wraps coverage collection as a regular StepResult-returning activity.
 */
async function runCoverageAsStep(
  workspacePath: string,
  config: Record<string, unknown>
): Promise<StepResult> {
  const startTime = Date.now();
  try {
    const result = await coverage.collectCoverage(workspacePath, config);
    const hasData = result.linePct > 0 || result.branchPct > 0 || result.functionPct > 0;
    return {
      status: hasData ? 'passed' : 'errored',
      summary: hasData
        ? `Coverage: ${result.linePct}% lines, ${result.branchPct}% branches, ${result.functionPct}% functions`
        : 'No coverage data found. Ensure your test framework generates coverage output.',
      details: {
        linePct: result.linePct,
        branchPct: result.branchPct,
        functionPct: result.functionPct,
        uncoveredFiles: result.uncovered.length,
        uncovered: result.uncovered.slice(0, 10),
      },
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      status: 'errored',
      summary: `Coverage collection failed: ${err}`,
      details: { error: String(err) },
      durationMs: Date.now() - startTime,
    };
  }
}

function getActivityForCheckType(checkType: string): ActivityRunner | null {
  switch (checkType) {
    case 'unit':
      return testRunner.runUnitTests;
    case 'integration':
      return testRunner.runUnitTests; // integration tests use same runner
    case 'lint':
      return testRunner.runLinter;
    case 'e2e':
      return testRunner.runE2ETests;
    case 'playwright_e2e':
      return e2e.runPlaywrightTests as unknown as ActivityRunner;
    case 'load':
      return testRunner.runLoadTests;
    case 'k6_load':
      return loadTest.runK6LoadTest as unknown as ActivityRunner;
    case 'sast':
      return security.runSAST;
    case 'dast':
      return security.runDAST;
    case 'dep_audit':
      return security.runDependencyAudit;
    case 'coverage':
      return runCoverageAsStep;
    default:
      return null;
  }
}

/**
 * Reports a phase (preparation step) to the UI so the user can see what's happening.
 */
async function reportPhase(
  runId: string,
  phaseName: string,
  fn: () => Promise<void>
): Promise<void> {
  await reporting.reportStepStarted(runId, phaseName);
  const startTime = Date.now();
  try {
    await fn();
    await reporting.reportStepResult(runId, phaseName, {
      status: 'passed',
      summary: `${phaseName} completed`,
      details: {},
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    await reporting.reportStepResult(runId, phaseName, {
      status: 'errored',
      summary: `${phaseName} failed: ${err}`,
      details: { error: String(err) },
      durationMs: Date.now() - startTime,
    });
    throw err;
  }
}

/**
 * Safely executes a step activity, catching errors so one step failure
 * does not crash the entire workflow.
 */
async function safeRunStep(
  runId: string,
  checkType: string,
  workspacePath: string,
  config: Record<string, unknown>
): Promise<StepResult> {
  try {
    // Report step as "running" so it appears on the UI immediately
    await reporting.reportStepStarted(runId, checkType);

    const activity = getActivityForCheckType(checkType);
    if (!activity) {
      const result: StepResult = {
        status: 'errored',
        summary: `Unknown check type: ${checkType}. Configure a supported check type.`,
        details: { checkType },
        durationMs: 0,
      };
      await reporting.reportStepResult(runId, checkType, result);
      return result;
    }

    const result = await activity(workspacePath, config);
    await reporting.reportStepResult(runId, checkType, result);
    return result;
  } catch (err) {
    const errorResult: StepResult = {
      status: 'errored',
      summary: `Activity ${checkType} threw an error: ${err}`,
      details: { error: String(err) },
      durationMs: 0,
    };
    try {
      await reporting.reportStepResult(runId, checkType, errorResult);
    } catch (_reportErr) {
      // Best-effort reporting
    }
    return errorResult;
  }
}

export async function testPipelineWorkflow(input: PipelineInput): Promise<void> {
  const { runId, repoUrl, commitSha, steps } = input;

  let overallStatus = 'COMPLETED';
  let workspacePath: string | undefined;
  const allResults = new Map<string, StepResult>();
  const collectedArtifactUrls: string[] = [];

  try {
    // 1. Notify pipeline service that the run has started
    await reporting.notifyRunStarted(runId);

    // 2. Clone/fetch the repository — visible as a step on UI
    await reportPhase(runId, 'repository_setup', async () => {
      workspacePath = await repository.prepareRepository(repoUrl, commitSha);
    });

    // 3. Separate steps into parallel, sequential, and unknown phases
    const parallelSteps = steps
      .filter((s) => PARALLEL_CHECK_TYPES.has(s.checkType))
      .sort((a, b) => a.order - b.order);

    const sequentialSteps = steps
      .filter((s) => SEQUENTIAL_CHECK_TYPES.has(s.checkType))
      .sort((a, b) => a.order - b.order);

    // Steps not in either set — run them sequentially at the end
    const otherSteps = steps
      .filter((s) => !PARALLEL_CHECK_TYPES.has(s.checkType) && !SEQUENTIAL_CHECK_TYPES.has(s.checkType))
      .sort((a, b) => a.order - b.order);

    // 4. Run parallel steps concurrently
    if (parallelSteps.length > 0) {
      const parallelPromises = parallelSteps.map(async (step) => {
        const result = await safeRunStep(runId, step.checkType, workspacePath!, step.config);
        return { checkType: step.checkType, result };
      });

      const results = await Promise.all(parallelPromises);
      for (const { checkType, result } of results) {
        allResults.set(checkType, result);
      }
    }

    // Check if any parallel step failed
    const hasParallelFailure = Array.from(allResults.values()).some(
      (r) => r.status === 'failed' || r.status === 'errored'
    );

    if (hasParallelFailure) {
      overallStatus = 'FAILED';
    }

    // 5. Run sequential steps (e.g., E2E only if unit tests passed)
    const unitResult = allResults.get('unit');
    const unitPassed = !unitResult || unitResult.status === 'passed';

    for (const step of sequentialSteps) {
      // E2E tests require unit tests to have passed
      if ((step.checkType === 'e2e' || step.checkType === 'playwright_e2e') && !unitPassed) {
        const skippedResult: StepResult = {
          status: 'failed',
          summary: `${step.checkType} tests skipped because unit tests did not pass`,
          details: { skipped: true, reason: 'unit_tests_failed' },
          durationMs: 0,
        };
        await reporting.reportStepResult(runId, step.checkType, skippedResult);
        allResults.set(step.checkType, skippedResult);
        overallStatus = 'FAILED';
        continue;
      }

      const result = await safeRunStep(runId, step.checkType, workspacePath!, step.config);
      allResults.set(step.checkType, result);

      if (result.status === 'failed' || result.status === 'errored') {
        overallStatus = 'FAILED';
      }
    }

    // 6. Run any other unknown step types sequentially
    for (const step of otherSteps) {
      const result = await safeRunStep(runId, step.checkType, workspacePath!, step.config);
      allResults.set(step.checkType, result);

      if (result.status === 'failed' || result.status === 'errored') {
        overallStatus = 'FAILED';
      }
    }

    // 7. Post-test phase: Coverage collection
    const coverageEnabled = steps.some(
      (s) => s.config.coverage === true || s.config.collectCoverage === true
    );

    let coverageResult: CoverageResult | undefined;
    let coverageDiff: CoverageDiff | undefined;

    if (coverageEnabled && workspacePath) {
      try {
        coverageResult = await coverage.collectCoverage(workspacePath, {});

        const baselineCoverage = (steps.find(
          (s) => s.config.baselineCoverage
        )?.config.baselineCoverage as CoverageResult | undefined) ?? null;

        coverageDiff = await coverage.compareCoverage(coverageResult, baselineCoverage);
      } catch (err) {
        const coverageError: StepResult = {
          status: 'errored',
          summary: `Coverage collection failed: ${err}`,
          details: { error: String(err) },
          durationMs: 0,
        };
        try {
          await reporting.reportStepResult(runId, 'coverage', coverageError);
        } catch (_reportErr) {
          // Best-effort
        }
      }
    }

    // 8. Post-test phase: Upload artifacts to MinIO
    if (workspacePath) {
      try {
        const artifactBucket = 'test-artifacts';
        const artifactPrefix = `runs/${runId}`;

        for (const [checkType, result] of allResults.entries()) {
          const screenshots = result.details.screenshots as string[] | undefined;
          const videos = result.details.videos as string[] | undefined;

          if (screenshots && screenshots.length > 0) {
            for (const screenshotPath of screenshots) {
              try {
                const fileName = screenshotPath.split('/').pop() || 'screenshot.png';
                const url = await artifacts.uploadArtifact(
                  screenshotPath,
                  artifactBucket,
                  `${artifactPrefix}/${checkType}/screenshots/${fileName}`
                );
                collectedArtifactUrls.push(url);
              } catch (_uploadErr) {
                // Best-effort upload
              }
            }
          }

          if (videos && videos.length > 0) {
            for (const videoPath of videos) {
              try {
                const fileName = videoPath.split('/').pop() || 'video.webm';
                const url = await artifacts.uploadArtifact(
                  videoPath,
                  artifactBucket,
                  `${artifactPrefix}/${checkType}/videos/${fileName}`
                );
                collectedArtifactUrls.push(url);
              } catch (_uploadErr) {
                // Best-effort upload
              }
            }
          }
        }

        if (coverageResult && workspacePath) {
          try {
            const coverageUrls = await artifacts.uploadDirectory(
              `${workspacePath}/coverage`,
              artifactBucket,
              `${artifactPrefix}/coverage`
            );
            collectedArtifactUrls.push(...coverageUrls);
          } catch (_uploadErr) {
            // Best-effort upload
          }
        }
      } catch (_artifactErr) {
        // Artifact upload failures should not crash the workflow
      }
    }

    // 9. Notify completion
    const completionDetails: Record<string, unknown> = {
      artifactUrls: collectedArtifactUrls,
    };

    if (coverageResult) {
      completionDetails.coverage = coverageResult;
    }
    if (coverageDiff) {
      completionDetails.coverageDiff = coverageDiff;
    }

    await reporting.notifyRunCompleted(runId, overallStatus);
  } catch (err) {
    try {
      await reporting.notifyRunCompleted(runId, 'ERRORED');
    } catch (_reportErr) {
      // Best-effort reporting
    }
    throw err;
  } finally {
    // 10. Clean up the workspace
    if (workspacePath) {
      try {
        await repository.cleanupRepository(workspacePath);
      } catch (_cleanupErr) {
        // Best-effort cleanup
      }
    }
  }
}
