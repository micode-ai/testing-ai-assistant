import { log } from '@temporalio/activity';
import fs from 'fs';
import path from 'path';
import type { StepResult, LoadTestConfig } from '../types';
import { exec, truncateOutput } from '../utils/exec';

/**
 * Runs a k6 load test using the provided configuration.
 * Executes actual k6 binary and parses JSON summary output.
 */
export async function runK6LoadTest(
  workspacePath: string,
  config: LoadTestConfig
): Promise<StepResult> {
  const startTime = Date.now();
  log.info('Running k6 load test', {
    workspacePath,
    script: config.script,
    vus: config.vus,
    duration: config.duration,
    thresholds: config.thresholds,
  });

  // Check k6 availability
  const k6Check = await exec('k6', ['version'], {
    cwd: workspacePath,
    timeoutMs: 10_000,
  });

  if (k6Check.exitCode !== 0) {
    return {
      status: 'errored',
      summary: 'k6 is not installed. Install k6 to run load tests: https://k6.io/docs/get-started/installation/',
      details: { error: 'k6 not found' },
      durationMs: Date.now() - startTime,
    };
  }

  // Resolve script path
  const scriptPath = path.isAbsolute(config.script)
    ? config.script
    : path.join(workspacePath, config.script);

  if (!fs.existsSync(scriptPath)) {
    return {
      status: 'errored',
      summary: `k6 script not found: ${config.script}`,
      details: { scriptPath },
      durationMs: Date.now() - startTime,
    };
  }

  // Build k6 args
  const summaryPath = path.join(workspacePath, 'k6-summary.json');
  const args = [
    'run',
    '--vus', String(config.vus),
    '--duration', config.duration,
    '--summary-export', summaryPath,
  ];

  // Add thresholds
  if (config.thresholds) {
    for (const [metric, conditions] of Object.entries(config.thresholds)) {
      for (const condition of conditions) {
        args.push('--threshold', `${metric}=${condition}`);
      }
    }
  }

  args.push(scriptPath);

  // Calculate timeout based on duration + buffer
  const durationSeconds = parseDuration(config.duration);
  const timeoutMs = (durationSeconds + 120) * 1000; // duration + 2 min buffer

  const result = await exec('k6', args, {
    cwd: workspacePath,
    timeoutMs,
  });

  const durationMs = Date.now() - startTime;

  // Parse k6 summary JSON
  const summary = parseK6Summary(summaryPath);

  const status = result.exitCode === 0 ? 'passed' : 'failed';

  log.info('k6 load test completed', { durationMs, status, exitCode: result.exitCode });

  return {
    status,
    summary: summary
      ? `Load test ${status}: p95=${summary.http_req_duration_p95?.toFixed(1)}ms, ${summary.http_reqs_count} requests, ${summary.iterations} iterations`
      : `Load test ${status} (exit code ${result.exitCode})`,
    details: {
      ...summary,
      vus: config.vus,
      duration: config.duration,
      exitCode: result.exitCode,
      output: truncateOutput(result.stdout + result.stderr),
    },
    durationMs,
  };
}

interface K6Summary {
  http_req_duration_avg: number;
  http_req_duration_p95: number;
  http_req_duration_p99: number;
  http_reqs_count: number;
  iterations: number;
  checks_passed_pct: number;
}

function parseK6Summary(summaryPath: string): K6Summary | null {
  try {
    if (!fs.existsSync(summaryPath)) return null;

    const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    const metrics = data.metrics || {};

    return {
      http_req_duration_avg: metrics.http_req_duration?.values?.avg ?? 0,
      http_req_duration_p95: metrics.http_req_duration?.values?.['p(95)'] ?? 0,
      http_req_duration_p99: metrics.http_req_duration?.values?.['p(99)'] ?? 0,
      http_reqs_count: metrics.http_reqs?.values?.count ?? 0,
      iterations: metrics.iterations?.values?.count ?? 0,
      checks_passed_pct: metrics.checks?.values?.rate
        ? metrics.checks.values.rate * 100
        : 100,
    };
  } catch {
    return null;
  }
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h)$/);
  if (!match) return 60;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    default: return 60;
  }
}
