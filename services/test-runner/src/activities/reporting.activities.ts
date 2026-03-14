import { log } from '@temporalio/activity';
import axios from 'axios';
import type { StepResult } from '../types';

const PIPELINE_SERVICE_URL =
  process.env.PIPELINE_SERVICE_URL || 'http://localhost:3004';

/**
 * Notifies the Pipeline Service that a test run has started.
 */
export async function notifyRunStarted(runId: string): Promise<void> {
  log.info('Notifying run started', { runId });

  try {
    await axios.patch(`${PIPELINE_SERVICE_URL}/api/v1/runs/${runId}/status`, {
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
    });
    log.info('Run start notification sent', { runId });
  } catch (err) {
    log.warn('Failed to notify run started (Pipeline Service may be unavailable)', {
      runId,
      error: String(err),
    });
    // Re-throw so Temporal retry policy can handle it
    throw err;
  }
}

/**
 * Notifies the Pipeline Service that a step has started executing.
 * Creates a TestResult record with RUNNING status so it appears on the UI immediately.
 */
export async function reportStepStarted(
  runId: string,
  checkType: string
): Promise<void> {
  log.info('Reporting step started', { runId, checkType });

  try {
    await axios.post(
      `${PIPELINE_SERVICE_URL}/api/v1/runs/${runId}/steps/${checkType}/result`,
      {
        status: 'running',
        summary: `Running ${checkType}...`,
        details: {},
        durationMs: 0,
      }
    );
    log.info('Step start reported', { runId, checkType });
  } catch (err) {
    log.warn('Failed to report step started', {
      runId,
      checkType,
      error: String(err),
    });
    // Non-critical, don't throw
  }
}

/**
 * Reports the result of a single pipeline step to the Pipeline Service.
 */
export async function reportStepResult(
  runId: string,
  checkType: string,
  result: StepResult
): Promise<void> {
  log.info('Reporting step result', { runId, checkType, status: result.status });

  try {
    await axios.post(
      `${PIPELINE_SERVICE_URL}/api/v1/runs/${runId}/steps/${checkType}/result`,
      {
        status: result.status,
        summary: result.summary,
        details: result.details,
        durationMs: result.durationMs,
        completedAt: new Date().toISOString(),
      }
    );
    log.info('Step result reported', { runId, checkType });
  } catch (err) {
    log.warn('Failed to report step result (Pipeline Service may be unavailable)', {
      runId,
      checkType,
      error: String(err),
    });
    throw err;
  }
}

/**
 * Notifies the Pipeline Service that a test run has completed with the given status.
 */
export async function notifyRunCompleted(
  runId: string,
  status: string
): Promise<void> {
  log.info('Notifying run completed', { runId, status });

  try {
    await axios.patch(`${PIPELINE_SERVICE_URL}/api/v1/runs/${runId}/status`, {
      status,
      completedAt: new Date().toISOString(),
    });
    log.info('Run completion notification sent', { runId, status });
  } catch (err) {
    log.warn('Failed to notify run completed (Pipeline Service may be unavailable)', {
      runId,
      status,
      error: String(err),
    });
    throw err;
  }
}
