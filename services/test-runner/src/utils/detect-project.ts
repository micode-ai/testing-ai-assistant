import fs from 'fs';
import path from 'path';

export interface ProjectInfo {
  type: 'node' | 'python' | 'go' | 'java' | 'unknown';
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'go' | 'maven' | 'gradle' | null;
  hasLockFile: boolean;
  testCommand: string | null;
  lintCommand: string | null;
  e2eCommand: string | null;
  coverageCommand: string | null;
  scripts: Record<string, string>;
}

/**
 * Detects project type, package manager, and available commands
 * by inspecting files in the workspace directory.
 */
export function detectProject(workspacePath: string): ProjectInfo {
  const info: ProjectInfo = {
    type: 'unknown',
    packageManager: null,
    hasLockFile: false,
    testCommand: null,
    lintCommand: null,
    e2eCommand: null,
    coverageCommand: null,
    scripts: {},
  };

  // Node.js detection
  const packageJsonPath = path.join(workspacePath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    info.type = 'node';

    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      info.scripts = pkg.scripts || {};
    } catch {
      // Malformed package.json
    }

    // Detect package manager
    if (fs.existsSync(path.join(workspacePath, 'pnpm-lock.yaml'))) {
      info.packageManager = 'pnpm';
      info.hasLockFile = true;
    } else if (fs.existsSync(path.join(workspacePath, 'yarn.lock'))) {
      info.packageManager = 'yarn';
      info.hasLockFile = true;
    } else if (fs.existsSync(path.join(workspacePath, 'package-lock.json'))) {
      info.packageManager = 'npm';
      info.hasLockFile = true;
    } else {
      info.packageManager = 'npm';
    }

    // Detect test command
    if (info.scripts['test']) {
      info.testCommand = `${info.packageManager} run test`;
    } else if (info.scripts['test:unit']) {
      info.testCommand = `${info.packageManager} run test:unit`;
    }

    // Detect lint command
    if (info.scripts['lint']) {
      info.lintCommand = `${info.packageManager} run lint`;
    } else if (fs.existsSync(path.join(workspacePath, '.eslintrc.js')) ||
               fs.existsSync(path.join(workspacePath, '.eslintrc.json')) ||
               fs.existsSync(path.join(workspacePath, 'eslint.config.js')) ||
               fs.existsSync(path.join(workspacePath, 'eslint.config.mjs'))) {
      info.lintCommand = 'npx eslint .';
    }

    // Detect e2e command
    if (info.scripts['test:e2e']) {
      info.e2eCommand = `${info.packageManager} run test:e2e`;
    } else if (info.scripts['e2e']) {
      info.e2eCommand = `${info.packageManager} run e2e`;
    }

    // Detect coverage command
    if (info.scripts['test:cov']) {
      info.coverageCommand = `${info.packageManager} run test:cov`;
    } else if (info.scripts['test:coverage']) {
      info.coverageCommand = `${info.packageManager} run test:coverage`;
    } else if (info.scripts['coverage']) {
      info.coverageCommand = `${info.packageManager} run coverage`;
    } else if (info.testCommand) {
      // Detect test framework to add correct coverage flag
      const testScript = info.scripts['test'] || '';
      if (testScript.includes('vitest')) {
        info.coverageCommand = `${info.testCommand} -- --coverage`;
      } else if (testScript.includes('jest') || testScript.includes('react-scripts')) {
        info.coverageCommand = `${info.testCommand} -- --coverage --coverageReporters=json-summary`;
      } else if (testScript.includes('mocha') || testScript.includes('nyc')) {
        info.coverageCommand = `npx nyc --reporter=json-summary ${info.testCommand}`;
      } else {
        // Generic fallback — try --coverage, many frameworks support it
        info.coverageCommand = `${info.testCommand} -- --coverage`;
      }
    }

    return info;
  }

  // Python detection
  if (fs.existsSync(path.join(workspacePath, 'requirements.txt')) ||
      fs.existsSync(path.join(workspacePath, 'pyproject.toml')) ||
      fs.existsSync(path.join(workspacePath, 'setup.py'))) {
    info.type = 'python';
    info.packageManager = 'pip';
    info.testCommand = 'python -m pytest';
    info.lintCommand = 'python -m pylint .';
    info.coverageCommand = 'python -m pytest --cov';
    return info;
  }

  // Go detection
  if (fs.existsSync(path.join(workspacePath, 'go.mod'))) {
    info.type = 'go';
    info.packageManager = 'go';
    info.testCommand = 'go test ./...';
    info.lintCommand = 'golangci-lint run';
    info.coverageCommand = 'go test -coverprofile=coverage.out ./...';
    return info;
  }

  // Java detection (Maven)
  if (fs.existsSync(path.join(workspacePath, 'pom.xml'))) {
    info.type = 'java';
    info.packageManager = 'maven';
    info.testCommand = 'mvn test';
    info.lintCommand = 'mvn checkstyle:check';
    return info;
  }

  // Java detection (Gradle)
  if (fs.existsSync(path.join(workspacePath, 'build.gradle')) ||
      fs.existsSync(path.join(workspacePath, 'build.gradle.kts'))) {
    info.type = 'java';
    info.packageManager = 'gradle';
    info.testCommand = './gradlew test';
    info.lintCommand = './gradlew check';
    return info;
  }

  return info;
}

/**
 * Returns the install command for the detected package manager.
 */
export function getInstallCommand(info: ProjectInfo): string | null {
  switch (info.packageManager) {
    case 'npm':
      return info.hasLockFile ? 'npm ci' : 'npm install';
    case 'yarn':
      return info.hasLockFile ? 'yarn install --frozen-lockfile' : 'yarn install';
    case 'pnpm':
      return info.hasLockFile ? 'pnpm install --frozen-lockfile' : 'pnpm install';
    case 'pip':
      return 'pip install -r requirements.txt';
    case 'go':
      return 'go mod download';
    case 'maven':
      return 'mvn dependency:resolve';
    case 'gradle':
      return './gradlew dependencies';
    default:
      return null;
  }
}
