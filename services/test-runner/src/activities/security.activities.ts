import { log } from '@temporalio/activity';
import type { StepResult } from '../types';
import { exec, truncateOutput } from '../utils/exec';
import { detectProject } from '../utils/detect-project';

/**
 * Runs Static Application Security Testing (SAST) on the codebase.
 * Uses Semgrep if available, otherwise falls back to basic checks.
 */
export async function runSAST(
  workspacePath: string,
  config: Record<string, unknown>
): Promise<StepResult> {
  const startTime = Date.now();
  log.info('Running SAST analysis', { workspacePath, config });

  // Try Semgrep first
  const semgrepCheck = await exec('semgrep', ['--version'], {
    cwd: workspacePath,
    timeoutMs: 10_000,
  });

  if (semgrepCheck.exitCode === 0) {
    const rulesets = (config.rulesets as string) || 'auto';
    const result = await exec('semgrep', ['scan', '--config', rulesets, '--json', '--quiet', '.'], {
      cwd: workspacePath,
      timeoutMs: 15 * 60 * 1000,
    });

    const durationMs = Date.now() - startTime;
    return parseSemgrepOutput(result.stdout, result.stderr, result.exitCode, durationMs);
  }

  // Fallback: run basic security patterns check using grep
  log.info('Semgrep not available, running basic security checks');

  const patterns = [
    { name: 'hardcoded secrets', pattern: '(password|secret|api_key|apikey)\\s*=\\s*["\'][^"\']+["\']', severity: 'high' },
    { name: 'eval usage', pattern: '\\beval\\s*\\(', severity: 'high' },
    { name: 'exec usage', pattern: '\\bexec\\s*\\(', severity: 'medium' },
    { name: 'innerHTML', pattern: '\\.innerHTML\\s*=', severity: 'medium' },
  ];

  const findings: { pattern: string; severity: string; count: number }[] = [];

  for (const p of patterns) {
    const result = await exec('grep', ['-r', '-l', '-E', p.pattern, '--include=*.ts', '--include=*.js', '--include=*.py', '.'], {
      cwd: workspacePath,
      timeoutMs: 30_000,
    });
    if (result.exitCode === 0 && result.stdout.trim()) {
      const fileCount = result.stdout.trim().split('\n').length;
      findings.push({ pattern: p.name, severity: p.severity, count: fileCount });
    }
  }

  const durationMs = Date.now() - startTime;
  const highFindings = findings.filter(f => f.severity === 'high');

  return {
    status: highFindings.length > 0 ? 'failed' : 'passed',
    summary: findings.length === 0
      ? 'No security issues found (basic scan)'
      : `Found ${findings.length} potential issue type(s) (basic scan, install Semgrep for thorough analysis)`,
    details: {
      tool: semgrepCheck.exitCode === 0 ? 'semgrep' : 'basic-grep',
      findings,
    },
    durationMs,
  };
}

/**
 * Runs Dynamic Application Security Testing (DAST) against a running application.
 * Uses OWASP ZAP if available.
 */
export async function runDAST(
  workspacePath: string,
  config: Record<string, unknown>
): Promise<StepResult> {
  const startTime = Date.now();
  log.info('Running DAST scan', { workspacePath, config });

  const targetUrl = config.targetUrl as string | undefined;
  if (!targetUrl) {
    return {
      status: 'errored',
      summary: 'No targetUrl configured for DAST scan. Provide "targetUrl" in step config.',
      details: {},
      durationMs: Date.now() - startTime,
    };
  }

  // Try OWASP ZAP
  const zapCheck = await exec('zap-cli', ['--version'], {
    cwd: workspacePath,
    timeoutMs: 10_000,
  });

  if (zapCheck.exitCode !== 0) {
    // Try docker-based ZAP
    const dockerZap = await exec('docker', [
      'run', '--rm', '-t',
      'ghcr.io/zaproxy/zaproxy:stable',
      'zap-baseline.py', '-t', targetUrl, '-J', 'report.json',
    ], {
      cwd: workspacePath,
      timeoutMs: 10 * 60 * 1000,
    });

    const durationMs = Date.now() - startTime;

    if (dockerZap.exitCode === 127) {
      return {
        status: 'errored',
        summary: 'DAST tools not available. Install OWASP ZAP or Docker.',
        details: { output: truncateOutput(dockerZap.stderr) },
        durationMs,
      };
    }

    return {
      status: dockerZap.exitCode === 0 ? 'passed' : 'failed',
      summary: dockerZap.exitCode === 0
        ? 'No critical vulnerabilities found in dynamic scan'
        : `DAST scan found issues (exit code ${dockerZap.exitCode})`,
      details: {
        tool: 'zap-docker',
        exitCode: dockerZap.exitCode,
        output: truncateOutput(dockerZap.stdout + dockerZap.stderr),
      },
      durationMs,
    };
  }

  const result = await exec('zap-cli', ['quick-scan', '-s', 'xss,sqli', targetUrl], {
    cwd: workspacePath,
    timeoutMs: 10 * 60 * 1000,
  });

  const durationMs = Date.now() - startTime;

  return {
    status: result.exitCode === 0 ? 'passed' : 'failed',
    summary: result.exitCode === 0
      ? 'No critical vulnerabilities found in dynamic scan'
      : 'DAST scan found potential vulnerabilities',
    details: {
      tool: 'zap',
      exitCode: result.exitCode,
      output: truncateOutput(result.stdout + result.stderr),
    },
    durationMs,
  };
}

/**
 * Runs dependency audit to check for known vulnerabilities.
 * Uses npm audit, pip-audit, or govulncheck depending on project type.
 */
export async function runDependencyAudit(
  workspacePath: string,
  config: Record<string, unknown>
): Promise<StepResult> {
  const startTime = Date.now();
  log.info('Running dependency audit', { workspacePath, config });

  const project = detectProject(workspacePath);

  let auditCmd: string;
  let auditArgs: string[];

  switch (project.packageManager) {
    case 'npm':
      auditCmd = 'npm';
      auditArgs = ['audit', '--json'];
      break;
    case 'yarn':
      auditCmd = 'yarn';
      auditArgs = ['audit', '--json'];
      break;
    case 'pnpm':
      auditCmd = 'pnpm';
      auditArgs = ['audit', '--json'];
      break;
    case 'pip':
      auditCmd = 'pip-audit';
      auditArgs = ['--format', 'json'];
      break;
    case 'go':
      auditCmd = 'govulncheck';
      auditArgs = ['./...'];
      break;
    default:
      return {
        status: 'errored',
        summary: `No audit tool available for project type: ${project.type}`,
        details: { projectType: project.type },
        durationMs: Date.now() - startTime,
      };
  }

  const result = await exec(auditCmd, auditArgs, {
    cwd: workspacePath,
    timeoutMs: 5 * 60 * 1000,
  });

  const durationMs = Date.now() - startTime;
  const output = result.stdout + result.stderr;

  // Parse npm audit JSON output
  if (['npm', 'pnpm', 'yarn'].includes(project.packageManager!)) {
    const parsed = parseNpmAuditOutput(result.stdout);
    const hasCritical = parsed.critical > 0 || parsed.high > 0;

    return {
      status: hasCritical ? 'failed' : 'passed',
      summary: parsed.total === 0
        ? 'No known vulnerabilities in dependencies'
        : `Found ${parsed.total} vulnerabilities (${parsed.critical} critical, ${parsed.high} high, ${parsed.moderate} moderate, ${parsed.low} low)`,
      details: {
        ...parsed,
        tool: `${project.packageManager}-audit`,
        exitCode: result.exitCode,
      },
      durationMs,
    };
  }

  return {
    status: result.exitCode === 0 ? 'passed' : 'failed',
    summary: result.exitCode === 0
      ? 'No known vulnerabilities found'
      : 'Dependency audit found vulnerabilities',
    details: {
      tool: auditCmd,
      exitCode: result.exitCode,
      output: truncateOutput(output),
    },
    durationMs,
  };
}

// --- Parsers ---

function parseSemgrepOutput(
  stdout: string,
  stderr: string,
  exitCode: number,
  durationMs: number,
): StepResult {
  try {
    const parsed = JSON.parse(stdout);
    const results = parsed.results || [];
    const bySeverity: Record<string, number> = {};
    for (const r of results) {
      const sev = r.extra?.severity || 'unknown';
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }

    const critical = (bySeverity['ERROR'] || 0) + (bySeverity['CRITICAL'] || 0);
    const high = bySeverity['WARNING'] || 0;

    return {
      status: critical > 0 ? 'failed' : 'passed',
      summary: results.length === 0
        ? 'No security findings'
        : `Found ${results.length} findings (${critical} critical/error, ${high} warning)`,
      details: {
        tool: 'semgrep',
        totalFindings: results.length,
        bySeverity,
        filesScanned: parsed.paths?.scanned?.length || 0,
      },
      durationMs,
    };
  } catch {
    return {
      status: exitCode === 0 ? 'passed' : 'failed',
      summary: exitCode === 0 ? 'SAST scan passed' : 'SAST scan found issues',
      details: {
        tool: 'semgrep',
        exitCode,
        output: truncateOutput(stdout + stderr),
      },
      durationMs,
    };
  }
}

function parseNpmAuditOutput(stdout: string): {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
} {
  const defaults = { total: 0, critical: 0, high: 0, moderate: 0, low: 0 };
  try {
    const parsed = JSON.parse(stdout);
    // npm audit --json format
    if (parsed.metadata?.vulnerabilities) {
      const v = parsed.metadata.vulnerabilities;
      return {
        total: v.total || 0,
        critical: v.critical || 0,
        high: v.high || 0,
        moderate: v.moderate || 0,
        low: v.low || 0,
      };
    }
    // pnpm audit format
    if (parsed.advisories) {
      const advisories = Object.values(parsed.advisories) as { severity: string }[];
      const result = { ...defaults };
      for (const a of advisories) {
        result.total++;
        if (a.severity === 'critical') result.critical++;
        else if (a.severity === 'high') result.high++;
        else if (a.severity === 'moderate') result.moderate++;
        else result.low++;
      }
      return result;
    }
  } catch {
    // Non-JSON output
  }
  return defaults;
}
