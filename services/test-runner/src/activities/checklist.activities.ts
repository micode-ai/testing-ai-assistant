import { log, heartbeat } from '@temporalio/activity';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { exec, truncateOutput } from '../utils/exec';

const PIPELINE_SERVICE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:3004';

export interface ChecklistItemInput {
  id: string;
  title: string;
  description: string;
  expectedBehavior: string;
  testCode: string | null;
}

export interface ChecklistItemTestResult {
  status: 'passed' | 'failed' | 'errored';
  summary: string;
  details: Record<string, unknown>;
  screenshots: string[];
  durationMs: number;
}

/**
 * Notifies that checklist run has started.
 */
export async function notifyChecklistRunStarted(runId: string): Promise<void> {
  log.info('Notifying checklist run started', { runId });
  await axios.patch(`${PIPELINE_SERVICE_URL}/api/v1/checklist-runs/${runId}/status`, {
    status: 'RUNNING',
  });
}

/**
 * Notifies that checklist run has completed.
 */
export async function notifyChecklistRunCompleted(runId: string, status: string): Promise<void> {
  log.info('Notifying checklist run completed', { runId, status });
  await axios.patch(`${PIPELINE_SERVICE_URL}/api/v1/checklist-runs/${runId}/status`, {
    status,
  });
}

/**
 * Reports a single checklist item result (started or completed).
 */
export async function reportChecklistItemResult(
  runId: string,
  itemId: string,
  data: {
    status: string;
    summary: string;
    details?: Record<string, unknown>;
    screenshots?: string[];
    durationMs?: number;
  },
): Promise<void> {
  log.info('Reporting checklist item result', { runId, itemId, status: data.status });
  await axios.post(`${PIPELINE_SERVICE_URL}/api/v1/checklist-runs/${runId}/items/${itemId}/result`, data);
}

/**
 * Executes a single checklist item's Playwright test against the target URL.
 */
export async function runChecklistItemTest(
  item: ChecklistItemInput,
  targetUrl: string,
): Promise<ChecklistItemTestResult> {
  const startTime = Date.now();

  if (!item.testCode) {
    return {
      status: 'errored',
      summary: `No test code generated for "${item.title}". Generate tests first.`,
      details: {},
      screenshots: [],
      durationMs: Date.now() - startTime,
    };
  }

  // Create temp workspace for this test
  const workDir = path.join(os.tmpdir(), 'checklist-tests', `item-${item.id}-${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    // Write test file with baseURL injected
    const testCode = injectBaseUrl(item.testCode, targetUrl);
    const testFilePath = path.join(workDir, 'test.spec.ts');
    fs.writeFileSync(testFilePath, testCode, 'utf-8');

    // Write minimal Playwright config
    const configContent = `
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    baseURL: '${targetUrl}',
    screenshot: 'on',
    trace: 'on-first-retry',
  },
  reporter: [['json', { outputFile: 'results.json' }]],
  timeout: 60000,
});
`;
    fs.writeFileSync(path.join(workDir, 'playwright.config.ts'), configContent, 'utf-8');

    // Write package.json so npx works
    fs.writeFileSync(path.join(workDir, 'package.json'), JSON.stringify({ name: 'checklist-test', private: true }), 'utf-8');

    // Install Playwright
    log.info('Installing Playwright for checklist item test');
    await exec('npx', ['playwright', 'install', 'chromium', '--with-deps'], {
      cwd: workDir,
      timeoutMs: 3 * 60 * 1000,
    });
    heartbeat();

    // Run the test
    log.info('Running Playwright test', { itemTitle: item.title, targetUrl });
    const result = await exec('npx', ['playwright', 'test', '--config=playwright.config.ts'], {
      cwd: workDir,
      timeoutMs: 2 * 60 * 1000,
    });
    heartbeat();

    const durationMs = Date.now() - startTime;
    const output = result.stdout + result.stderr;

    // Collect screenshots
    const screenshots = collectScreenshots(workDir);

    // Parse results
    const jsonResultsPath = path.join(workDir, 'results.json');
    const parsed = parsePlaywrightJson(jsonResultsPath);

    if (result.exitCode === 0) {
      return {
        status: 'passed',
        summary: parsed?.summary || `"${item.title}" passed`,
        details: {
          ...parsed,
          output: truncateOutput(output),
        },
        screenshots,
        durationMs,
      };
    }

    return {
      status: 'failed',
      summary: parsed?.summary || `"${item.title}" failed (exit ${result.exitCode})`,
      details: {
        ...parsed,
        exitCode: result.exitCode,
        output: truncateOutput(output),
      },
      screenshots,
      durationMs,
    };
  } catch (err) {
    return {
      status: 'errored',
      summary: `Error running test for "${item.title}": ${err}`,
      details: { error: String(err) },
      screenshots: [],
      durationMs: Date.now() - startTime,
    };
  } finally {
    // Cleanup
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // Best-effort
    }
  }
}

/**
 * Injects baseURL into test code if not already present.
 */
function injectBaseUrl(testCode: string, targetUrl: string): string {
  // If the test already references baseURL or the target URL, leave it alone
  if (testCode.includes('baseURL') || testCode.includes(targetUrl)) {
    return testCode;
  }
  // Add a comment at the top
  return `// Target URL: ${targetUrl}\n// baseURL is configured via playwright.config.ts\n\n${testCode}`;
}

function collectScreenshots(workDir: string): string[] {
  const screenshotDir = path.join(workDir, 'test-results');
  const files: string[] = [];

  try {
    if (!fs.existsSync(screenshotDir)) return files;
    walkDir(screenshotDir, '.png', files);
  } catch {
    // Best-effort
  }

  return files;
}

function walkDir(dir: string, ext: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, ext, out);
    else if (entry.name.endsWith(ext)) out.push(full);
  }
}

function parsePlaywrightJson(jsonPath: string): { summary: string; passed: number; failed: number } | null {
  try {
    if (!fs.existsSync(jsonPath)) return null;
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    let passed = 0, failed = 0;

    for (const suite of data.suites || []) {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          for (const r of test.results || []) {
            if (r.status === 'passed') passed++;
            else failed++;
          }
        }
      }
    }

    return {
      summary: failed > 0 ? `${failed} assertion(s) failed` : `${passed} assertion(s) passed`,
      passed,
      failed,
    };
  } catch {
    return null;
  }
}
