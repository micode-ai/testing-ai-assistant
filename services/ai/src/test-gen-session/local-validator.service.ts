import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  ValidationError,
  parseTscOutput,
  parseEslintJson,
} from './validation-error-parser.util';

const execAsync = promisify(exec);

export interface ValidateParams {
  repoUrl: string;
  branch: string;
  token: string;
  provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET';
  packageManager: string | null;
  tests: Array<{ path: string; content: string }>;
  onProgress?: (phase: string) => void;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  tscOutput: string;
  eslintOutput: string;
}

@Injectable()
export class LocalValidatorService {
  private readonly logger = new Logger(LocalValidatorService.name);

  async validate(params: ValidateParams): Promise<ValidationResult> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-test-val-'));
    this.logger.log(`Validation workspace: ${tmpDir}`);

    try {
      // 1. Clone
      params.onProgress?.('cloning');
      await this.cloneRepo(tmpDir, params);

      // 2. Install dependencies
      params.onProgress?.('installing');
      await this.installDeps(tmpDir, params.packageManager);

      // 3. Install deps in package dirs too (monorepo)
      const packageDirs = await this.findPackageDirs(tmpDir, params.tests.map((t) => t.path));
      for (const pkgDir of packageDirs) {
        if (pkgDir !== tmpDir) {
          params.onProgress?.('installing');
          try {
            const pkgPm = await this.detectPackageManager(pkgDir);
            await this.exec(`${pkgPm} install --ignore-scripts`, {
              cwd: pkgDir,
              timeout: 180_000,
              env: { ...process.env, CI: 'true' },
            });
          } catch {
            this.logger.warn(`Failed to install deps in ${pkgDir}, continuing`);
          }
        }
      }

      // 4. Copy test files
      params.onProgress?.('copying');
      await this.copyTestFiles(tmpDir, params.tests);

      // 5. Run tsc
      params.onProgress?.('type_checking');
      const tscResult = await this.runTsc(tmpDir, params.tests);

      // 6. Run eslint
      params.onProgress?.('linting');
      const eslintResult = await this.runEslint(tmpDir, params.tests);

      const allErrors = [...tscResult.errors, ...eslintResult.errors];

      return {
        valid: allErrors.length === 0,
        errors: allErrors,
        tscOutput: tscResult.output,
        eslintOutput: eslintResult.output,
      };
    } finally {
      // Cleanup
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
        this.logger.log(`Cleaned up validation workspace: ${tmpDir}`);
      } catch (err) {
        this.logger.warn(`Failed to cleanup ${tmpDir}: ${(err as Error).message}`);
      }
    }
  }

  private async cloneRepo(tmpDir: string, params: ValidateParams): Promise<void> {
    const authUrl = this.buildAuthUrl(params.repoUrl, params.token, params.provider);
    const q = (s: string) => `"${s}"`;

    try {
      await this.exec(
        `git clone --depth=1 --single-branch --branch ${q(params.branch)} ${q(authUrl)} ${q(tmpDir)}`,
        { timeout: 120_000 },
      );
    } catch {
      const subDir = path.join(tmpDir, 'repo');
      await this.exec(
        `git clone --depth=1 --single-branch --branch ${q(params.branch)} ${q(authUrl)} ${q(subDir)}`,
        { timeout: 120_000 },
      );
      const entries = await fs.readdir(subDir);
      for (const entry of entries) {
        await fs.rename(path.join(subDir, entry), path.join(tmpDir, entry));
      }
      await fs.rm(subDir, { recursive: true, force: true });
    }

    this.logger.log(`Cloned repo to ${tmpDir}`);
  }

  private buildAuthUrl(
    repoUrl: string,
    token: string,
    provider: string,
  ): string {
    const url = new URL(repoUrl.replace(/\.git$/, '') + '.git');

    switch (provider) {
      case 'GITHUB':
        url.username = 'x-access-token';
        url.password = token;
        break;
      case 'GITLAB':
        url.username = 'oauth2';
        url.password = token;
        break;
      case 'BITBUCKET':
        url.username = 'x-token-auth';
        url.password = token;
        break;
    }

    return url.toString();
  }

  private async installDeps(workDir: string, packageManager: string | null): Promise<void> {
    const pm = packageManager || await this.detectPackageManager(workDir);

    let installCmd: string;
    switch (pm) {
      case 'pnpm':
        installCmd = 'pnpm install --frozen-lockfile --ignore-scripts';
        break;
      case 'yarn':
        installCmd = 'yarn install --frozen-lockfile --ignore-scripts';
        break;
      default:
        installCmd = 'npm ci --ignore-scripts';
        break;
    }

    try {
      await this.exec(installCmd, {
        cwd: workDir,
        timeout: 180_000,
        env: { ...process.env, CI: 'true' },
      });
      this.logger.log(`Dependencies installed with ${pm}`);
    } catch {
      this.logger.warn(`${pm} install with lockfile failed, retrying without...`);
      await this.exec(`${pm} install --ignore-scripts`, {
        cwd: workDir,
        timeout: 180_000,
        env: { ...process.env, CI: 'true' },
      });
      this.logger.log(`Dependencies installed with ${pm} (no lockfile)`);
    }
  }

  private async detectPackageManager(workDir: string): Promise<string> {
    try {
      await fs.access(path.join(workDir, 'pnpm-lock.yaml'));
      return 'pnpm';
    } catch { /* ignore */ }
    try {
      await fs.access(path.join(workDir, 'yarn.lock'));
      return 'yarn';
    } catch { /* ignore */ }
    return 'npm';
  }

  private async copyTestFiles(
    workDir: string,
    tests: Array<{ path: string; content: string }>,
  ): Promise<void> {
    for (const test of tests) {
      const fullPath = path.join(workDir, test.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, test.content, 'utf-8');
    }
    this.logger.log(`Copied ${tests.length} test file(s)`);
  }

  private async runTsc(
    workDir: string,
    tests: Array<{ path: string }>,
  ): Promise<{ errors: ValidationError[]; output: string }> {
    const testPaths = tests.map((t) => t.path);

    // Find package directories that contain test files (monorepo support)
    const packageDirs = await this.findPackageDirs(workDir, testPaths);

    const allErrors: ValidationError[] = [];
    let allOutput = '';

    for (const pkgDir of packageDirs) {
      // Check if tsconfig.json exists in this package
      const tsconfigPath = path.join(pkgDir, 'tsconfig.json');
      try {
        await fs.access(tsconfigPath);
      } catch {
        this.logger.log(`No tsconfig.json in ${pkgDir}, skipping tsc`);
        continue;
      }

      try {
        // Run tsc --noEmit from the package directory (uses its tsconfig.json)
        const { stderr } = await this.exec('npx tsc --noEmit', {
          cwd: pkgDir,
          timeout: 120_000,
        });
        allOutput += stderr;
      } catch (error: any) {
        const output = (error.stdout || '') + '\n' + (error.stderr || '');
        allOutput += output;
        const errors = parseTscOutput(output);

        // Filter to only errors in our test files
        const relevantErrors = errors.filter(
          (e) => testPaths.some((tp) => e.file.endsWith(tp) || e.file.includes(tp)),
        );
        allErrors.push(...relevantErrors);
      }
    }

    this.logger.log(`tsc found ${allErrors.length} error(s) in test files`);
    return { errors: allErrors, output: allOutput };
  }

  /**
   * Find package directories containing the test files.
   * For monorepos, returns the package-level dirs (e.g., packages/api).
   * For single-package repos, returns the workDir.
   */
  private async findPackageDirs(
    workDir: string,
    testPaths: string[],
  ): Promise<string[]> {
    const dirs = new Set<string>();

    for (const testPath of testPaths) {
      // Walk up from the test file to find the nearest package.json
      const parts = testPath.split('/');
      for (let i = parts.length - 1; i >= 0; i--) {
        const candidate = path.join(workDir, ...parts.slice(0, i));
        try {
          await fs.access(path.join(candidate, 'package.json'));
          dirs.add(candidate);
          break;
        } catch { /* continue up */ }
      }
    }

    // Fallback to workDir if nothing found
    if (dirs.size === 0) dirs.add(workDir);
    return Array.from(dirs);
  }

  private async runEslint(
    workDir: string,
    tests: Array<{ path: string }>,
  ): Promise<{ errors: ValidationError[]; output: string }> {
    const testPaths = tests.map((t) => t.path);
    const packageDirs = await this.findPackageDirs(workDir, testPaths);

    const allErrors: ValidationError[] = [];
    let allOutput = '';

    for (const pkgDir of packageDirs) {
      // Check if eslint config exists in this package or workDir
      const hasEslint = await this.hasEslintConfig(pkgDir) || await this.hasEslintConfig(workDir);

      if (!hasEslint) {
        this.logger.log(`No eslint config found in ${pkgDir}, skipping lint`);
        continue;
      }

      // Get test files relative to the package dir
      const pkgRelative = path.relative(workDir, pkgDir);
      const pkgTestPaths = testPaths
        .filter((tp) => pkgRelative === '' || tp.startsWith(pkgRelative))
        .map((tp) => pkgRelative ? tp.slice(pkgRelative.length + 1) : tp);

      if (pkgTestPaths.length === 0) continue;

      const filesArg = pkgTestPaths.map((p) => `"${p}"`).join(' ');

      try {
        const { stdout } = await this.exec(`npx eslint --format json ${filesArg}`, {
          cwd: pkgDir,
          timeout: 60_000,
        });
        allOutput += stdout;
      } catch (error: any) {
        const output = error.stdout || '';
        allOutput += output;
        const errors = parseEslintJson(output);
        allErrors.push(...errors);
      }
    }

    this.logger.log(`eslint found ${allErrors.length} error(s)`);
    return { errors: allErrors, output: allOutput };
  }

  private async hasEslintConfig(dir: string): Promise<boolean> {
    const configs = ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', '.eslintrc', 'eslint.config.js', 'eslint.config.mjs'];
    for (const config of configs) {
      try {
        await fs.access(path.join(dir, config));
        return true;
      } catch { /* ignore */ }
    }
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8'));
      if (pkg.eslintConfig) return true;
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Execute a shell command. Works cross-platform (Windows, Linux, macOS).
   */
  private async exec(
    command: string,
    options: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv } = {},
  ): Promise<{ stdout: string; stderr: string }> {
    const isWindows = os.platform() === 'win32';

    return execAsync(command, {
      ...options,
      shell: isWindows ? 'cmd.exe' : '/bin/sh',
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
  }
}
