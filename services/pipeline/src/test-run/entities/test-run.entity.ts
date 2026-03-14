import { TestRunStatus } from '../../../generated/prisma';

export class TestRunEntity {
  id: string;
  pipelineId: string;
  commitSha: string;
  branch: string;
  status: TestRunStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  triggeredBy: string | null;
  metadata: unknown;
  createdAt: Date;
}
