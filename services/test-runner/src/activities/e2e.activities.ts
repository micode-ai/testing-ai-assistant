import { log } from '@temporalio/activity';
import fs from 'fs';
import path from 'path';
import type { StepResult, PlaywrightConfig } from '../types';
import { exec, truncateOutput } from '../utils/exec';

/**
 * Runs Playwright-based E2E tests in the given workspace.
 */
export async function runPlaywrightTests(
  workspacePath: string,
  config: PlaywrightConfig
): Promise<StepResult> {
  const startTime = Date.now();
  log.info('Running Playwright E2E tests', {
    workspacePath,
    browsers: config.browsers,
    headless: config.headless,
    testDir: config.testDir,
    timeout: config.timeout,
  });

  // Install Playwright browsers if needed
  const installResult = await exec('npx', ['playwright', 'install', '--with-deps', ...config.browsers], {
    cwd: workspacePath,
    timeoutMs: 5 * 60 * 1000,
  });

  if (installResult.exitCode !== 0) {
    log.warn('Playwright browser install may have failed', {
      exitCode: installResult.exitCode,
      stderr: installResult.stderr.slice(0, 1000),
    });
  }

  // Build test command args
  const args = ['playwright', 'test'];

  if (config.testDir) {
    args.push(config.testDir);
  }

  // Add reporter for JSON output
  args.push('--reporter=json');

  // Run only specified browsers
  for (const browser of config.browsers) {
    args.push('--project', browser);
  }

  const env: Record<string, string> = {
    PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(workspacePath, 'playwright-results.json'),
  };

  if (config.baseUrl) {
    env.BASE_URL = config.baseUrl;
  }

  const result = await exec('npx', args, {
    cwd: workspacePath,
    timeoutMs: (config.timeout || 25 * 60 * 1000),
    env,
  });

  const durationMs = Date.now() - startTime;

  // Try to parse JSON results
  const jsonResultPath = path.join(workspacePath, 'playwright-results.json');
  const parsed = parsePlaywrightResults(jsonResultPath, result.stdout);

  // Collect artifacts
  const screenshots = collectArtifacts(workspacePath, 'test-results', '.png');
  const videos = collectArtifacts(workspacePath, 'test-results', '.webm');

  const status = result.exitCode === 0 ? 'passed' : 'failed';

  log.info('Playwright E2E tests completed', {
    durationMs,
    status,
    ...parsed,
    screenshotCount: screenshots.length,
    videoCount: videos.length,
  });

  return {
    status,
    summary: parsed.summary || (status === 'passed' ? 'Playwright tests passed' : 'Playwright tests failed'),
    details: {
      ...parsed,
      screenshots,
      videos,
      browsers: config.browsers,
      headless: config.headless,
      exitCode: result.exitCode,
      output: truncateOutput(result.stdout + result.stderr),
    },
    durationMs,
  };
}

function parsePlaywrightResults(
  jsonPath: string,
  stdout: string
): { summary: string | null; passed: number; failed: number; skipped: number; testCount: number } {
  const defaults = { summary: null, passed: 0, failed: 0, skipped: 0, testCount: 0 };

  // Try JSON file first
  try {
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const suites = data.suites || [];
      let passed = 0, failed = 0, skipped = 0;

      function countTests(suite: { specs?: { tests?: { results?: { status: string }[] }[] }[]; suites?: unknown[] }) {
        for (const spec of suite.specs || []) {
          for (const test of spec.tests || []) {
            for (const result of test.results || []) {
              if (result.status === 'passed') passed++;
              else if (result.status === 'failed' || result.status === 'timedOut') failed++;
              else if (result.status === 'skipped') skipped++;
            }
          }
        }
        for (const child of (suite.suites || []) as typeof suites) {
          countTests(child);
        }
      }

      for (const suite of suites) {
        countTests(suite);
      }

      const total = passed + failed + skipped;
      return {
        summary: `${passed}/${total} Playwright tests passed${failed > 0 ? `, ${failed} failed` : ''}`,
        passed,
        failed,
        skipped,
        testCount: total,
      };
    }
  } catch {
    // Fall through to stdout parsing
  }

  // Parse stdout
  const match = stdout.match(/(\d+)\s+passed(?:.*?(\d+)\s+failed)?/);
  if (match) {
    const passed = parseInt(match[1], 10);
    const failed = parseInt(match[2], 10) || 0;
    const total = passed + failed;
    return {
      summary: `${passed}/${total} tests passed`,
      passed,
      failed,
      skipped: 0,
      testCount: total,
    };
  }

  return defaults;
}

function collectArtifacts(workspacePath: string, dir: string, extension: string): string[] {
  const artifactDir = path.join(workspacePath, dir);
  const files: string[] = [];

  try {
    if (!fs.existsSync(artifactDir)) return files;
    collectFilesRecursive(artifactDir, extension, files);
  } catch {
    // Best-effort
  }

  return files;
}

function collectFilesRecursive(dir: string, extension: string, files: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(fullPath, extension, files);
    } else if (entry.name.endsWith(extension)) {
      files.push(fullPath);
    }
  }
}
