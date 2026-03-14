import { log } from '@temporalio/activity';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { exec } from '../utils/exec';
import { detectProject, getInstallCommand } from '../utils/detect-project';

const WORKSPACES_DIR = process.env.WORKSPACES_DIR || path.join(os.tmpdir(), 'test-runner');

/**
 * Prepares the repository workspace by cloning the repo and checking out the given commit.
 * Installs project dependencies after checkout.
 * Returns the workspace path where the code is available.
 */
export async function prepareRepository(
  repoUrl: string,
  commitSha: string
): Promise<string> {
  log.info('Preparing repository', { repoUrl, commitSha });

  const workspaceId = `ws-${commitSha.substring(0, 8)}-${Date.now()}`;
  const workspacePath = path.join(WORKSPACES_DIR, workspaceId);

  // Ensure parent directory exists
  fs.mkdirSync(workspacePath, { recursive: true });

  // Clone the repository
  log.info('Cloning repository', { repoUrl, workspacePath });
  const cloneResult = await exec('git', ['clone', '--depth', '50', repoUrl, '.'], {
    cwd: workspacePath,
    timeoutMs: 5 * 60 * 1000,
  });

  if (cloneResult.exitCode !== 0) {
    throw new Error(`Git clone failed (exit ${cloneResult.exitCode}): ${cloneResult.stderr}`);
  }

  // Checkout specific commit (if not a manual trigger placeholder)
  if (commitSha && !commitSha.startsWith('manual-')) {
    log.info('Checking out commit', { commitSha });
    const checkoutResult = await exec('git', ['checkout', commitSha], {
      cwd: workspacePath,
      timeoutMs: 30_000,
    });

    if (checkoutResult.exitCode !== 0) {
      log.warn('Failed to checkout commit, staying on default branch', {
        commitSha,
        stderr: checkoutResult.stderr,
      });
    }
  }

  // Detect project and install dependencies
  const project = detectProject(workspacePath);
  log.info('Detected project type', {
    type: project.type,
    packageManager: project.packageManager,
  });

  const installCmd = getInstallCommand(project);
  if (installCmd) {
    log.info('Installing dependencies', { command: installCmd });
    const [cmd, ...args] = installCmd.split(' ');
    const installResult = await exec(cmd, args, {
      cwd: workspacePath,
      timeoutMs: 5 * 60 * 1000,
    });

    if (installResult.exitCode !== 0) {
      log.warn('Dependency install failed, proceeding anyway', {
        exitCode: installResult.exitCode,
        stderr: installResult.stderr.slice(0, 2000),
      });
    }
  }

  log.info('Repository prepared', { workspacePath, projectType: project.type });
  return workspacePath;
}

/**
 * Cleans up the repository workspace after all steps have completed.
 */
export async function cleanupRepository(workspacePath: string): Promise<void> {
  log.info('Cleaning up repository workspace', { workspacePath });

  try {
    fs.rmSync(workspacePath, { recursive: true, force: true });
    log.info('Repository workspace cleaned up', { workspacePath });
  } catch (err) {
    log.warn('Failed to clean up workspace', { workspacePath, error: String(err) });
  }
}
