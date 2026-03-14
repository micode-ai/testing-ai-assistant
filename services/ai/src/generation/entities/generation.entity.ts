import { AIGeneration, GenerationType, Prisma } from '../../../generated/prisma';

export class GenerationEntity implements AIGeneration {
  id: string;
  projectId: string;
  type: GenerationType;
  inputContext: Prisma.JsonValue;
  output: string;
  model: string;
  tokensUsed: number;
  accepted: boolean | null;
  feedback: string | null;
  createdAt: Date;

  constructor(partial: Partial<GenerationEntity>) {
    Object.assign(this, partial);
  }
}
