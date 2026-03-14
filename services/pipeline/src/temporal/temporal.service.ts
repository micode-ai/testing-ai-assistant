import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Connection } from '@temporalio/client';

export interface PipelineInput {
  runId: string;
  pipelineId: string;
  projectId: string;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  commitSha: string;
  branch: string;
  steps: { checkType: string; order: number; config: Record<string, unknown> }[];
}

@Injectable()
export class TemporalService implements OnModuleDestroy {
  private readonly logger = new Logger(TemporalService.name);
  private client: Client | null = null;
  private connection: Connection | null = null;
  private readonly address: string;
  private readonly namespace: string;
  private readonly taskQueue: string;

  constructor(private readonly configService: ConfigService) {
    this.address = this.configService.get('TEMPORAL_ADDRESS', '127.0.0.1:7233');
    this.namespace = this.configService.get('TEMPORAL_NAMESPACE', 'default');
    this.taskQueue = this.configService.get('TEMPORAL_TASK_QUEUE', 'test-pipeline');
  }

  private async getClient(): Promise<Client> {
    if (this.client) return this.client;

    this.connection = await Connection.connect({ address: this.address });
    this.client = new Client({ connection: this.connection, namespace: this.namespace });
    this.logger.log(`Connected to Temporal at ${this.address}`);
    return this.client;
  }

  async startTestPipeline(input: PipelineInput): Promise<string> {
    const client = await this.getClient();

    const handle = await client.workflow.start('testPipelineWorkflow', {
      args: [input],
      taskQueue: this.taskQueue,
      workflowId: `test-pipeline-${input.runId}`,
      workflowExecutionTimeout: '2 hours',
    });

    this.logger.log(`Started workflow ${handle.workflowId} for run ${input.runId}`);
    return handle.workflowId;
  }

  async onModuleDestroy() {
    if (this.connection) {
      await this.connection.close();
      this.logger.log('Temporal connection closed');
    }
  }
}
