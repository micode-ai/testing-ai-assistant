import { Client, Connection } from '@temporalio/client';
import type { PipelineInput } from '../types';

/**
 * Creates and returns a connected Temporal Client instance.
 */
export async function createTemporalClient(): Promise<Client> {
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE || 'default';

  const connection = await Connection.connect({
    address: temporalAddress,
  });

  return new Client({
    connection,
    namespace,
  });
}

/**
 * Starts a test pipeline workflow execution on Temporal.
 *
 * @param input - The pipeline configuration including repo details and steps to execute
 * @returns The workflow execution ID (same as runId for easy correlation)
 */
export async function startTestPipeline(input: PipelineInput): Promise<string> {
  const client = await createTemporalClient();
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'test-pipeline';

  try {
    const handle = await client.workflow.start('testPipelineWorkflow', {
      args: [input],
      taskQueue,
      workflowId: `test-pipeline-${input.runId}`,
      // Allow the workflow to run for up to 2 hours
      workflowExecutionTimeout: '2 hours',
    });

    console.log(
      `Started test pipeline workflow: ${handle.workflowId} (runId: ${handle.firstExecutionRunId})`
    );

    return handle.workflowId;
  } finally {
    // Close the client connection to avoid resource leaks
    const connection = client.connection;
    await connection.close();
  }
}
