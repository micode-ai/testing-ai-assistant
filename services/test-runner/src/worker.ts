import dotenv from 'dotenv';
dotenv.config();

import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(address: string): Promise<NativeConnection> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const connection = await NativeConnection.connect({ address });
      return connection;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      console.warn(
        `[test-runner] Temporal not available at ${address} (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${RETRY_DELAY_MS / 1000}s...`,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw new Error('Unreachable');
}

async function run(): Promise<void> {
  const temporalAddress = process.env.TEMPORAL_ADDRESS || '127.0.0.1:7233';
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'test-pipeline';
  const namespace = process.env.TEMPORAL_NAMESPACE || 'default';

  console.log(`[test-runner] Connecting to Temporal at ${temporalAddress}...`);

  let connection: NativeConnection;
  try {
    connection = await connectWithRetry(temporalAddress);
  } catch {
    console.warn(
      `[test-runner] Could not connect to Temporal at ${temporalAddress} after ${MAX_RETRIES} attempts. ` +
        'The test-runner worker will not be available. Start Temporal and restart this service to enable it.',
    );
    // Keep the process alive so turbo doesn't treat it as a failure
    await new Promise(() => {});
    return;
  }

  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  console.log(`[test-runner] Worker started on task queue: ${taskQueue}`);
  console.log(`[test-runner] Namespace: ${namespace}`);

  await worker.run();
}

run().catch((err) => {
  console.error('[test-runner] Fatal error:', err);
  process.exit(1);
});
