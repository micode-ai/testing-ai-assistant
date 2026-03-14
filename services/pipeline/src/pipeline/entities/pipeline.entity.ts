import { PipelineTrigger } from '../../../generated/prisma';

export class PipelineEntity {
  id: string;
  projectId: string;
  name: string;
  trigger: PipelineTrigger;
  cronExpr: string | null;
  steps: unknown;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
