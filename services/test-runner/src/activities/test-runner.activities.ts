import { log } from '@temporalio/activity';
import type { StepResult } from '../types';
import { exec, truncateOutput } from '../utils/exec';
import { detectProject } from '../utils/detect-project';

/**
 * Runs unit tests in the given workspace using the project's test runner.
 */
export async function runUnitTests(
  workspacePath: string,
  config: Record<string, unknown>
): Promise<StepResult> {
  const startTime = Date.now();
  log.info('Running unit tests', { workspacePath, config });

  const project = detectProject(workspacePath);

  // Determine test command
  let testCmd = config.command as string | undefined;
  if (!testCmd) {
    testCmd = project.testCommand || undefined;
  }

  if (!testCmd) {
    return {
      status: 'errored',
      summary: 'No test command found. Add a "test" script to package.json or provide command in step config.',
      details: { projectType: project.type },
      durationMs: Date.now() - startTime,
    };
  }

  const [cmd, ...args] = testCmd.split(' ');

  // Add JSON reporter if Jest is detected
  const env: Record<string, string> = {};
  if (project.scripts['test']?.includes('jest') || testCmd.includes('jest')) {
    env.JEST_JUNIT_OUTPUT_DIR = workspacePath;
  }

  const result = await exec(cmd, args, {
    cwd: workspacePath,
    timeoutMs: 25 * 60 * 1000, // 25 min (activity timeout is 30 min)
    env,
  });

  const durationMs = Date.now() - startTime;
  const output = result.stdout + result.stderr;

  // Parse test results from output
  const parsed = parseTestOutput(output);

  if (result.exitCode === 0) {
    log.info('Unit tests passed', { durationMs, ...parsed });
    return {
      status: 'passed',
      summary: parsed.summary || 'All tests passed',
      details: {
        ...parsed,
        exitCode: result.exitCode,
        output: truncateOutput(output),
      },
      durationMs,
    };
  }

  log.info('Unit tests failed', { durationMs, exitCode: result.exitCode });
  return {
    status: 'failed',
    summary: parsed.summary || `Tests failed with exit code ${result.exitCode}`,
    details: {
      ...parsed,
      exitCode: result.exitCode,
      output: truncateOutput(output),
    },
    durationMs,
  };
}

/**
 * Runs linting checks in the given workspace using the project's linter.
 */
export async function runLinter(
  workspacePath: string,
  config: Record<string, unknown>
): Promise<StepResult> {
  const startTime = Date.now();
  log.info('Running linter', { workspacePath, config });

  const project = detectProject(workspacePath);

  let lintCmd = config.command as string | undefined;
  if (!lintCmd) {
    lintCmd = project.lintCommand || undefined;
  }

  if (!lintCmd) {
    return {
      status: 'errored',
      summary: 'No lint command found. Add a "lint" script to package.json or provide command in step config.',
      details: { projectType: project.type },
      durationMs: Date.now() - startTime,
    };
  }

  const [cmd, ...args] = lintCmd.split(' ');

  const result = await exec(cmd, args, {
    cwd: workspacePath,
    timeoutMs: 10 * 60 * 1000,
  });

  const durationMs = Date.now() - startTime;
  const output = result.stdout + result.stderr;

  const parsed = parseLintOutput(output);

  if (result.exitCode === 0) {
    log.info('Linting passed', { durationMs, ...parsed });
    return {
      status: 'passed',
      summary: parsed.summary || 'No linting issues found',
      details: {
        ...parsed,
        exitCode: result.exitCode,
        output: truncateOutput(output),
      },
      durationMs,
    };
  }

  log.info('Linting failed', { durationMs, exitCode: result.exitCode });
  return {
    status: 'failed',
    summary: parsed.summary || `Linting failed with ${parsed.errors} error(s) and ${parsed.warnings} warning(s)`,
    details: {
      ...parsed,
      exitCode: result.exitCode,
      output: truncateOutput(output),
    },
    durationMs,
  };
}

/**
 * Runs end-to-end tests in the given workspace.
 */
export async function runE2ETests(
  workspacePath: string,
  config: Record<string, unknown>
): Promise<StepResult> {
  const startTime = Date.now();
  log.info('Running E2E tests', { workspacePath, config });

  const project = detectProject(workspacePath);

  let e2eCmd = config.command as string | undefined;
  if (!e2eCmd) {
    e2eCmd = project.e2eCommand || undefined;
  }

  if (!e2eCmd) {
    return {
      status: 'errored',
      summary: 'No E2E test command found. Add a "test:e2e" script or provide command in step config.',
      details: { projectType: project.type },
      durationMs: Date.now() - startTime,
    };
  }

  const [cmd, ...args] = e2eCmd.split(' ');

  const result = await exec(cmd, args, {
    cwd: workspacePath,
    timeoutMs: 25 * 60 * 1000,
  });

  const durationMs = Date.now() - startTime;
  const output = result.stdout + result.stderr;
  const parsed = parseTestOutput(output);

  if (result.exitCode === 0) {
    return {
      status: 'passed',
      summary: parsed.summary || 'E2E tests passed',
      details: {
        ...parsed,
        exitCode: result.exitCode,
        output: truncateOutput(output),
      },
      durationMs,
    };
  }

  return {
    status: 'failed',
    summary: parsed.summary || `E2E tests failed with exit code ${result.exitCode}`,
    details: {
      ...parsed,
      exitCode: result.exitCode,
      output: truncateOutput(output),
    },
    durationMs,
  };
}

/**
 * Runs load/performance tests in the given workspace.
 */
export async function runLoadTests(
  workspacePath: string,
  config: Record<string, unknown>
): Promise<StepResult> {
  const startTime = Date.now();
  log.info('Running load tests', { workspacePath, config });

  const loadCmd = config.command as string | undefined;
  if (!loadCmd) {
    return {
      status: 'errored',
      summary: 'No load test command configured. Provide "command" in step config.',
      details: {},
      durationMs: Date.now() - startTime,
    };
  }

  const [cmd, ...args] = loadCmd.split(' ');

  const result = await exec(cmd, args, {
    cwd: workspacePath,
    timeoutMs: 25 * 60 * 1000,
  });

  const durationMs = Date.now() - startTime;
  const output = result.stdout + result.stderr;

  if (result.exitCode === 0) {
    return {
      status: 'passed',
      summary: 'Load test passed',
      details: {
        exitCode: result.exitCode,
        output: truncateOutput(output),
      },
      durationMs,
    };
  }

  return {
    status: 'failed',
    summary: `Load test failed with exit code ${result.exitCode}`,
    details: {
      exitCode: result.exitCode,
      output: truncateOutput(output),
    },
    durationMs,
  };
}

// --- Output parsers ---

interface TestParseResult {
  summary: string | null;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
}

function parseTestOutput(output: string): TestParseResult {
  const result: TestParseResult = {
    summary: null,
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  // Jest format: Tests: X passed, Y failed, Z total
  const jestMatch = output.match(/Tests:\s+(\d+)\s+passed(?:,\s+(\d+)\s+failed)?(?:,\s+(\d+)\s+skipped)?(?:,\s+(\d+)\s+total)?/i);
  if (jestMatch) {
    result.passed = parseInt(jestMatch[1], 10) || 0;
    result.failed = parseInt(jestMatch[2], 10) || 0;
    result.skipped = parseInt(jestMatch[3], 10) || 0;
    result.totalTests = parseInt(jestMatch[4], 10) || (result.passed + result.failed + result.skipped);
    result.summary = `${result.passed}/${result.totalTests} tests passed`;
    if (result.failed > 0) {
      result.summary += `, ${result.failed} failed`;
    }
    return result;
  }

  // Vitest format: Tests X passed | Y failed (Z)
  const vitestMatch = output.match(/Tests\s+(\d+)\s+passed(?:\s+\|\s+(\d+)\s+failed)?\s+\((\d+)\)/i);
  if (vitestMatch) {
    result.passed = parseInt(vitestMatch[1], 10) || 0;
    result.failed = parseInt(vitestMatch[2], 10) || 0;
    result.totalTests = parseInt(vitestMatch[3], 10) || 0;
    result.summary = `${result.passed}/${result.totalTests} tests passed`;
    return result;
  }

  // pytest format: X passed, Y failed
  const pytestMatch = output.match(/(\d+)\s+passed(?:,\s+(\d+)\s+failed)?/i);
  if (pytestMatch) {
    result.passed = parseInt(pytestMatch[1], 10) || 0;
    result.failed = parseInt(pytestMatch[2], 10) || 0;
    result.totalTests = result.passed + result.failed;
    result.summary = `${result.passed}/${result.totalTests} tests passed`;
    return result;
  }

  // Go test format: ok / FAIL
  const goPassMatch = output.match(/^ok\s+/m);
  const goFailMatch = output.match(/^FAIL\s+/m);
  if (goPassMatch || goFailMatch) {
    const passCount = (output.match(/^ok\s+/gm) || []).length;
    const failCount = (output.match(/^FAIL\s+/gm) || []).length;
    result.passed = passCount;
    result.failed = failCount;
    result.totalTests = passCount + failCount;
    result.summary = `${passCount}/${result.totalTests} packages passed`;
    return result;
  }

  return result;
}

interface LintParseResult {
  summary: string | null;
  errors: number;
  warnings: number;
  filesChecked: number;
}

function parseLintOutput(output: string): LintParseResult {
  const result: LintParseResult = {
    summary: null,
    errors: 0,
    warnings: 0,
    filesChecked: 0,
  };

  // ESLint format: X problems (Y errors, Z warnings)
  const eslintMatch = output.match(/(\d+)\s+problems?\s*\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/i);
  if (eslintMatch) {
    const total = parseInt(eslintMatch[1], 10);
    result.errors = parseInt(eslintMatch[2], 10);
    result.warnings = parseInt(eslintMatch[3], 10);
    result.summary = total === 0
      ? 'No linting issues found'
      : `${result.errors} error(s), ${result.warnings} warning(s)`;
    return result;
  }

  // Count error/warning lines
  const errorLines = (output.match(/error\s/gi) || []).length;
  const warningLines = (output.match(/warning\s/gi) || []).length;
  if (errorLines > 0 || warningLines > 0) {
    result.errors = errorLines;
    result.warnings = warningLines;
    result.summary = `${errorLines} error(s), ${warningLines} warning(s)`;
  }

  return result;
}
