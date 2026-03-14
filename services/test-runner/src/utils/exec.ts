import { spawn } from 'child_process';
import { heartbeat } from '@temporalio/activity';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface ExecOptions {
  cwd: string;
  timeoutMs?: number;
  /** Interval in ms to call Temporal heartbeat (default: 30_000) */
  heartbeatIntervalMs?: number;
  env?: Record<string, string>;
}

/**
 * Executes a shell command in the given working directory.
 * Captures stdout/stderr, respects timeout, and calls Temporal heartbeat periodically.
 */
export function exec(command: string, args: string[], options: ExecOptions): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000; // 10 min default
    const heartbeatInterval = options.heartbeatIntervalMs ?? 30_000;

    const env = { ...process.env, ...options.env };

    const child = spawn(command, args, {
      cwd: options.cwd,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    // Periodic heartbeat so Temporal knows the activity is alive
    const hbTimer = setInterval(() => {
      try {
        heartbeat();
      } catch {
        // Activity may have been cancelled
      }
    }, heartbeatInterval);

    // Timeout guard
    const timeoutTimer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000);
    }, timeoutMs);

    child.on('error', (err) => {
      clearInterval(hbTimer);
      clearTimeout(timeoutTimer);
      reject(err);
    });

    child.on('close', (code) => {
      clearInterval(hbTimer);
      clearTimeout(timeoutTimer);

      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
        exitCode: code ?? 1,
        durationMs: Date.now() - startTime,
      });
    });
  });
}

/**
 * Truncates output to a max length for storing in step details.
 */
export function truncateOutput(output: string, maxLength = 10_000): string {
  if (output.length <= maxLength) return output;
  return output.slice(0, maxLength) + `\n... (truncated, ${output.length} total chars)`;
}
