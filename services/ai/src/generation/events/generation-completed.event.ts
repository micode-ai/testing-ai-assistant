import { GenerationType } from '../../../generated/prisma';

export class GenerationCompletedEvent {
  static readonly EVENT_NAME = 'generation.completed';

  constructor(
    public readonly generationId: string,
    public readonly projectId: string,
    public readonly type: GenerationType,
    public readonly model: string,
    public readonly tokensUsed: number,
  ) {}
}
