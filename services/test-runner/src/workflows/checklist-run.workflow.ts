import { proxyActivities } from '@temporalio/workflow';
import type * as checklistActivities from '../activities/checklist.activities';

const checklist = proxyActivities<typeof checklistActivities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3 },
  heartbeatTimeout: '3 minutes',
});

export interface ChecklistRunInput {
  runId: string;
  checklistId: string;
  targetUrl: string;
  items: {
    id: string;
    title: string;
    description: string;
    expectedBehavior: string;
    testCode: string | null;
  }[];
}

/**
 * Temporal workflow that executes all checklist items sequentially
 * against the target URL and reports results in real-time.
 */
export async function checklistRunWorkflow(input: ChecklistRunInput): Promise<void> {
  const { runId, items, targetUrl } = input;

  let hasFailures = false;

  try {
    // 1. Notify run started
    await checklist.notifyChecklistRunStarted(runId);

    // 2. Execute each item sequentially
    for (const item of items) {
      // Report item as running
      await checklist.reportChecklistItemResult(runId, item.id, {
        status: 'RUNNING',
        summary: `Running "${item.title}"...`,
      });

      // Execute the test
      const result = await checklist.runChecklistItemTest(item, targetUrl);

      // Report item result
      await checklist.reportChecklistItemResult(runId, item.id, {
        status: result.status === 'passed' ? 'PASSED' : result.status === 'failed' ? 'FAILED' : 'FAILED',
        summary: result.summary,
        details: result.details,
        screenshots: result.screenshots,
        durationMs: result.durationMs,
      });

      if (result.status !== 'passed') {
        hasFailures = true;
      }
    }

    // 3. Notify run completed
    await checklist.notifyChecklistRunCompleted(runId, hasFailures ? 'FAILED' : 'COMPLETED');
  } catch (err) {
    try {
      await checklist.notifyChecklistRunCompleted(runId, 'ERRORED');
    } catch {
      // Best-effort
    }
    throw err;
  }
}
