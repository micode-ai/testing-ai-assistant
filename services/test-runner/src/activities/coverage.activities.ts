import { log } from '@temporalio/activity';
import fs from 'fs';
import path from 'path';
import type { CoverageResult, CoverageDiff } from '../types';
import { exec } from '../utils/exec';
import { detectProject } from '../utils/detect-project';

/**
 * Collects code coverage data from the workspace.
 * Runs the project's coverage command and parses the output.
 */
export async function collectCoverage(
  workspacePath: string,
  config: Record<string, unknown>
): Promise<CoverageResult> {
  log.info('Collecting coverage data', { workspacePath, config });

  // Check if coverage data already exists (from a previous test run step)
  const existingCoverage = tryParseCoverageFiles(workspacePath);
  if (existingCoverage) {
    log.info('Found existing coverage data', existingCoverage);
    return existingCoverage;
  }

  // Run coverage command
  const project = detectProject(workspacePath);
  let coverageCmd = config.command as string | undefined;
  if (!coverageCmd) {
    coverageCmd = project.coverageCommand || undefined;
  }

  if (!coverageCmd) {
    log.warn('No coverage command available', { projectType: project.type, scripts: Object.keys(project.scripts) });
    return { linePct: 0, branchPct: 0, functionPct: 0, uncovered: [] };
  }

  // Ensure json-summary reporter is included for Node.js/Jest projects
  // so we get coverage/coverage-summary.json even if the script doesn't configure it
  if (project.type === 'node' && !coverageCmd.includes('coverageReporters')) {
    const testScript = project.scripts['test'] || project.scripts['test:cov'] || '';
    const isJest = testScript.includes('jest') || testScript.includes('react-scripts')
      || fs.existsSync(path.join(workspacePath, 'jest.config.js'))
      || fs.existsSync(path.join(workspacePath, 'jest.config.ts'))
      || fs.existsSync(path.join(workspacePath, 'jest.config.mjs'));

    if (isJest) {
      // For direct script invocations (e.g. pnpm run test:cov), append via --
      // Only if not already passing extra flags
      if (!coverageCmd.includes('--')) {
        coverageCmd += ' -- --coverageReporters=json-summary --coverageReporters=text';
      } else if (!coverageCmd.includes('coverageReporters')) {
        coverageCmd += ' --coverageReporters=json-summary --coverageReporters=text';
      }
    }
  }

  log.info('Running coverage command', { coverageCmd });
  const [cmd, ...args] = coverageCmd.split(' ');
  const execResult = await exec(cmd, args, {
    cwd: workspacePath,
    timeoutMs: 10 * 60 * 1000,
    env: { FORCE_COLOR: '0' }, // Disable color codes that can interfere with parsing
  });

  log.info('Coverage command finished', {
    exitCode: execResult.exitCode,
    stdoutLength: execResult.stdout.length,
    stderrLength: execResult.stderr.length,
    stderrSnippet: execResult.stderr.slice(0, 500),
  });

  // Search for coverage files in multiple common locations
  const result = tryParseCoverageFiles(workspacePath);
  if (result) {
    log.info('Coverage data collected from files', result);
    return result;
  }

  // If command ran but no files found, try parsing coverage from stdout
  const combined = execResult.stdout + execResult.stderr;
  const stdoutCoverage = parseCoverageFromStdout(combined);
  if (stdoutCoverage) {
    log.info('Coverage parsed from stdout', stdoutCoverage);
    return stdoutCoverage;
  }

  log.warn('Could not parse coverage output', {
    exitCode: execResult.exitCode,
    stdoutSnippet: execResult.stdout.slice(-500),
    stderrSnippet: execResult.stderr.slice(-500),
  });
  return { linePct: 0, branchPct: 0, functionPct: 0, uncovered: [] };
}

/**
 * Compares current coverage against a baseline to determine improvement or regression.
 */
export async function compareCoverage(
  current: CoverageResult,
  baseline: CoverageResult | null
): Promise<CoverageDiff> {
  log.info('Comparing coverage against baseline', { hasBaseline: baseline !== null });

  if (!baseline) {
    log.info('No baseline coverage found; treating as first run');
    return { lineDelta: 0, branchDelta: 0, functionDelta: 0, improved: true };
  }

  const lineDelta = parseFloat((current.linePct - baseline.linePct).toFixed(2));
  const branchDelta = parseFloat((current.branchPct - baseline.branchPct).toFixed(2));
  const functionDelta = parseFloat((current.functionPct - baseline.functionPct).toFixed(2));
  const improved = lineDelta >= 0 && branchDelta >= 0 && functionDelta >= 0;

  const diff: CoverageDiff = { lineDelta, branchDelta, functionDelta, improved };
  log.info('Coverage comparison completed', diff);

  return diff;
}

/**
 * Tries to find and parse coverage files in common locations.
 * Searches the workspace root and one level of subdirectories (monorepo packages).
 */
function tryParseCoverageFiles(workspacePath: string): CoverageResult | null {
  // First try the workspace root
  const rootResult = tryParseCoverageInDir(workspacePath);
  if (rootResult) return rootResult;

  // Search one level of subdirectories for monorepo projects
  // (e.g. packages/foo/coverage/, apps/web/coverage/)
  const subDirCandidates = ['packages', 'apps', 'services', 'libs', 'src'];
  for (const subDir of subDirCandidates) {
    const subDirPath = path.join(workspacePath, subDir);
    if (!fs.existsSync(subDirPath) || !fs.statSync(subDirPath).isDirectory()) continue;

    try {
      const children = fs.readdirSync(subDirPath);
      for (const child of children) {
        const childPath = path.join(subDirPath, child);
        if (!fs.statSync(childPath).isDirectory()) continue;

        const childResult = tryParseCoverageInDir(childPath);
        if (childResult) {
          log.info('Found coverage data in subdirectory', { subPath: `${subDir}/${child}` });
          return childResult;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Tries to parse coverage files in a single directory.
 */
function tryParseCoverageInDir(dirPath: string): CoverageResult | null {
  // Search multiple common coverage output locations
  const jsonPaths = [
    'coverage/coverage-summary.json',
    'coverage/coverage-final.json',
    // Jest default with different config
    'jest-coverage/coverage-summary.json',
    // Vitest
    'coverage/coverage-report.json',
    // Monorepo patterns
    'test-results/coverage-summary.json',
  ];

  for (const rel of jsonPaths) {
    const fullPath = path.join(dirPath, rel);
    if (fs.existsSync(fullPath)) {
      log.info('Found coverage JSON file', { path: fullPath });
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        if (data.total) {
          return {
            linePct: data.total.lines?.pct ?? 0,
            branchPct: data.total.branches?.pct ?? 0,
            functionPct: data.total.functions?.pct ?? 0,
            uncovered: extractUncoveredFiles(data),
          };
        }
        // coverage-final.json format (per-file)
        if (Object.values(data).some((v: any) => v && typeof v === 'object' && 's' in v)) {
          return parseCoverageFinal(data);
        }
      } catch (err) {
        log.warn('Failed to parse coverage JSON', { path: fullPath, error: String(err) });
        continue;
      }
    }
  }

  // lcov.info in multiple locations
  const lcovPaths = [
    'coverage/lcov.info',
    'coverage/lcov-report/lcov.info',
    'lcov.info',
  ];

  for (const rel of lcovPaths) {
    const fullPath = path.join(dirPath, rel);
    if (fs.existsSync(fullPath)) {
      log.info('Found lcov file', { path: fullPath });
      try {
        const result = parseLcov(fs.readFileSync(fullPath, 'utf-8'));
        if (result.linePct > 0 || result.branchPct > 0 || result.functionPct > 0) {
          return result;
        }
      } catch (err) {
        log.warn('Failed to parse lcov', { path: fullPath, error: String(err) });
        continue;
      }
    }
  }

  // Clover XML (common in PHP/Java)
  const cloverPath = path.join(dirPath, 'coverage', 'clover.xml');
  if (fs.existsSync(cloverPath)) {
    try {
      return parseCloverXml(fs.readFileSync(cloverPath, 'utf-8'));
    } catch {
      // Fall through
    }
  }

  // Go coverage
  const goCoveragePath = path.join(dirPath, 'coverage.out');
  if (fs.existsSync(goCoveragePath)) {
    return parseGoCoverage(dirPath, goCoveragePath);
  }

  // Python .coverage / coverage.xml
  const pyCoveragePath = path.join(dirPath, 'coverage.xml');
  if (fs.existsSync(pyCoveragePath)) {
    try {
      return parseCoberturaXml(fs.readFileSync(pyCoveragePath, 'utf-8'));
    } catch {
      // Fall through
    }
  }

  return null;
}

/**
 * Parses coverage percentages from test runner stdout output.
 * Handles Jest, Vitest, nyc, pytest-cov, go test formats.
 */
function parseCoverageFromStdout(output: string): CoverageResult | null {
  // Jest/Istanbul table format:
  // All files | 85.71 | 75 | 100 | 85.71 |
  const istanbulMatch = output.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (istanbulMatch) {
    return {
      linePct: parseFloat(istanbulMatch[4]),  // Lines %
      branchPct: parseFloat(istanbulMatch[2]), // Branches %
      functionPct: parseFloat(istanbulMatch[3]), // Funcs %
      uncovered: [],
    };
  }

  // Alternative: Stmts | Branch | Funcs | Lines (table header format)
  const tableMatch = output.match(/% ?Stmts\s*\|\s*% ?Branch\s*\|\s*% ?Funcs\s*\|\s*% ?Lines[\s\S]*?All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (tableMatch) {
    return {
      linePct: parseFloat(tableMatch[4]),
      branchPct: parseFloat(tableMatch[2]),
      functionPct: parseFloat(tableMatch[3]),
      uncovered: [],
    };
  }

  // Vitest format: Statements : 85.71% ... Branches : 75% ... Functions : 100% ... Lines : 85.71%
  const vitestMatch = output.match(/Statements\s*:\s*([\d.]+)%.*?Branches\s*:\s*([\d.]+)%.*?Functions\s*:\s*([\d.]+)%.*?Lines\s*:\s*([\d.]+)%/s);
  if (vitestMatch) {
    return {
      linePct: parseFloat(vitestMatch[4]),
      branchPct: parseFloat(vitestMatch[2]),
      functionPct: parseFloat(vitestMatch[3]),
      uncovered: [],
    };
  }

  // Jest "text" reporter alternate format (without "All files" row, just individual files and a summary)
  // Stmts | Branch | Funcs | Lines ... followed by percentage rows
  const stmtsPctMatch = output.match(/(?:^|\n)\s*(?:All files?|TOTAL)\s*\|?\s*([\d.]+)\s*%?\s*\|?\s*([\d.]+)\s*%?\s*\|?\s*([\d.]+)\s*%?\s*\|?\s*([\d.]+)/m);
  if (stmtsPctMatch) {
    return {
      linePct: parseFloat(stmtsPctMatch[4]),
      branchPct: parseFloat(stmtsPctMatch[2]),
      functionPct: parseFloat(stmtsPctMatch[3]),
      uncovered: [],
    };
  }

  // pytest-cov: TOTAL 500 450 90%
  const pytestMatch = output.match(/TOTAL\s+\d+\s+\d+\s+([\d.]+)%/);
  if (pytestMatch) {
    return {
      linePct: parseFloat(pytestMatch[1]),
      branchPct: 0,
      functionPct: 0,
      uncovered: [],
    };
  }

  // go test: coverage: 85.7% of statements
  const goMatch = output.match(/coverage:\s+([\d.]+)%\s+of\s+statements/);
  if (goMatch) {
    return {
      linePct: parseFloat(goMatch[1]),
      branchPct: 0,
      functionPct: 0,
      uncovered: [],
    };
  }

  return null;
}

/**
 * Parses Clover XML coverage format (PHP, Java).
 */
function parseCloverXml(xml: string): CoverageResult {
  const stmtsMatch = xml.match(/statements="(\d+)"/);
  const covStmtsMatch = xml.match(/coveredstatements="(\d+)"/);
  const methodsMatch = xml.match(/methods="(\d+)"/);
  const covMethodsMatch = xml.match(/coveredmethods="(\d+)"/);
  const condsMatch = xml.match(/conditionals="(\d+)"/);
  const covCondsMatch = xml.match(/coveredconditionals="(\d+)"/);

  const stmts = parseInt(stmtsMatch?.[1] || '0', 10);
  const covStmts = parseInt(covStmtsMatch?.[1] || '0', 10);
  const methods = parseInt(methodsMatch?.[1] || '0', 10);
  const covMethods = parseInt(covMethodsMatch?.[1] || '0', 10);
  const conds = parseInt(condsMatch?.[1] || '0', 10);
  const covConds = parseInt(covCondsMatch?.[1] || '0', 10);

  return {
    linePct: stmts > 0 ? parseFloat(((covStmts / stmts) * 100).toFixed(2)) : 0,
    branchPct: conds > 0 ? parseFloat(((covConds / conds) * 100).toFixed(2)) : 0,
    functionPct: methods > 0 ? parseFloat(((covMethods / methods) * 100).toFixed(2)) : 0,
    uncovered: [],
  };
}

/**
 * Parses Cobertura XML coverage format (Python, Java).
 */
function parseCoberturaXml(xml: string): CoverageResult {
  const lineRateMatch = xml.match(/line-rate="([\d.]+)"/);
  const branchRateMatch = xml.match(/branch-rate="([\d.]+)"/);

  const lineRate = parseFloat(lineRateMatch?.[1] || '0');
  const branchRate = parseFloat(branchRateMatch?.[1] || '0');

  return {
    linePct: parseFloat((lineRate * 100).toFixed(2)),
    branchPct: parseFloat((branchRate * 100).toFixed(2)),
    functionPct: 0,
    uncovered: [],
  };
}

function extractUncoveredFiles(
  data: Record<string, { lines?: { pct: number }; uncovered?: number[] }>
): CoverageResult['uncovered'] {
  const uncovered: CoverageResult['uncovered'] = [];

  for (const [file, info] of Object.entries(data)) {
    if (file === 'total') continue;
    const linePct = info.lines?.pct ?? 100;
    if (linePct < 100 && info.uncovered) {
      uncovered.push({ file, lines: info.uncovered });
    }
  }

  return uncovered.slice(0, 20); // Limit to 20 files
}

function parseCoverageFinal(
  data: Record<string, { s: Record<string, number>; b: Record<string, number[]>; f: Record<string, number> }>
): CoverageResult {
  let totalLines = 0, coveredLines = 0;
  let totalBranches = 0, coveredBranches = 0;
  let totalFunctions = 0, coveredFunctions = 0;
  const uncovered: CoverageResult['uncovered'] = [];

  for (const [file, fileCov] of Object.entries(data)) {
    const stmtValues = Object.values(fileCov.s || {});
    totalLines += stmtValues.length;
    coveredLines += stmtValues.filter(v => v > 0).length;

    const branchValues = Object.values(fileCov.b || {}).flat();
    totalBranches += branchValues.length;
    coveredBranches += branchValues.filter(v => v > 0).length;

    const funcValues = Object.values(fileCov.f || {});
    totalFunctions += funcValues.length;
    coveredFunctions += funcValues.filter(v => v > 0).length;

    const uncoveredStmts = Object.entries(fileCov.s || {})
      .filter(([, v]) => v === 0)
      .map(([k]) => parseInt(k, 10));

    if (uncoveredStmts.length > 0) {
      uncovered.push({ file, lines: uncoveredStmts.slice(0, 10) });
    }
  }

  return {
    linePct: totalLines > 0 ? parseFloat(((coveredLines / totalLines) * 100).toFixed(2)) : 0,
    branchPct: totalBranches > 0 ? parseFloat(((coveredBranches / totalBranches) * 100).toFixed(2)) : 0,
    functionPct: totalFunctions > 0 ? parseFloat(((coveredFunctions / totalFunctions) * 100).toFixed(2)) : 0,
    uncovered: uncovered.slice(0, 20),
  };
}

function parseLcov(lcovContent: string): CoverageResult {
  let totalLines = 0, coveredLines = 0;
  let totalBranches = 0, coveredBranches = 0;
  let totalFunctions = 0, coveredFunctions = 0;

  for (const line of lcovContent.split('\n')) {
    const lf = line.match(/^LF:(\d+)/);
    if (lf) totalLines += parseInt(lf[1], 10);

    const lh = line.match(/^LH:(\d+)/);
    if (lh) coveredLines += parseInt(lh[1], 10);

    const brf = line.match(/^BRF:(\d+)/);
    if (brf) totalBranches += parseInt(brf[1], 10);

    const brh = line.match(/^BRH:(\d+)/);
    if (brh) coveredBranches += parseInt(brh[1], 10);

    const fnf = line.match(/^FNF:(\d+)/);
    if (fnf) totalFunctions += parseInt(fnf[1], 10);

    const fnh = line.match(/^FNH:(\d+)/);
    if (fnh) coveredFunctions += parseInt(fnh[1], 10);
  }

  return {
    linePct: totalLines > 0 ? parseFloat(((coveredLines / totalLines) * 100).toFixed(2)) : 0,
    branchPct: totalBranches > 0 ? parseFloat(((coveredBranches / totalBranches) * 100).toFixed(2)) : 0,
    functionPct: totalFunctions > 0 ? parseFloat(((coveredFunctions / totalFunctions) * 100).toFixed(2)) : 0,
    uncovered: [],
  };
}

function parseGoCoverage(workspacePath: string, coveragePath: string): CoverageResult {
  // Use go tool cover to get percentage
  // Synchronous fallback: just parse the file
  const content = fs.readFileSync(coveragePath, 'utf-8');
  const lines = content.split('\n').filter(l => l && !l.startsWith('mode:'));

  let totalStmts = 0, coveredStmts = 0;

  for (const line of lines) {
    // format: file:startLine.startCol,endLine.endCol statements count
    const match = line.match(/\s+(\d+)\s+(\d+)$/);
    if (match) {
      const stmts = parseInt(match[1], 10);
      const count = parseInt(match[2], 10);
      totalStmts += stmts;
      if (count > 0) coveredStmts += stmts;
    }
  }

  return {
    linePct: totalStmts > 0 ? parseFloat(((coveredStmts / totalStmts) * 100).toFixed(2)) : 0,
    branchPct: 0,
    functionPct: 0,
    uncovered: [],
  };
}
