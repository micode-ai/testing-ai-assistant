import { TestCheckType, TestStatus } from '../../../generated/prisma';

export class TestResultEntity {
  id: string;
  runId: string;
  checkType: TestCheckType;
  status: TestStatus;
  summary: string;
  details: unknown;
  artifactUrl: string | null;
  durationMs: number;
  createdAt: Date;
}
