import { z } from 'zod';

export const pipelineStepSchema = z.object({
  name: z.string().min(1, 'Step name is required').max(100),
  checkType: z.enum(['LINT', 'UNIT_TEST', 'INTEGRATION_TEST', 'E2E_TEST', 'COVERAGE', 'SECURITY_SCAN']),
  config: z.record(z.unknown()).optional().default({}),
  order: z.number().int().min(0),
});

export const createPipelineSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  triggerType: z.enum(['PUSH', 'PULL_REQUEST', 'SCHEDULE', 'MANUAL']),
  cronExpression: z.string().max(100).optional(),
  steps: z.array(pipelineStepSchema).min(1, 'At least one step is required'),
});

export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;
