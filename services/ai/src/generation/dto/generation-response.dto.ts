import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GenerationType } from '../../../generated/prisma';
import { GenerationEntity } from '../entities/generation.entity';

export class GenerationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty({ enum: GenerationType })
  type: GenerationType;

  @ApiProperty()
  inputContext: unknown;

  @ApiProperty()
  output: string;

  @ApiProperty()
  model: string;

  @ApiProperty()
  tokensUsed: number;

  @ApiPropertyOptional()
  accepted: boolean | null;

  @ApiPropertyOptional()
  feedback: string | null;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(entity: GenerationEntity): GenerationResponseDto {
    const dto = new GenerationResponseDto();
    dto.id = entity.id;
    dto.projectId = entity.projectId;
    dto.type = entity.type;
    dto.inputContext = entity.inputContext;
    dto.output = entity.output;
    dto.model = entity.model;
    dto.tokensUsed = entity.tokensUsed;
    dto.accepted = entity.accepted;
    dto.feedback = entity.feedback;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}

export class GenerationStatsDto {
  @ApiProperty()
  totalGenerations: number;

  @ApiProperty()
  byType: Record<string, number>;

  @ApiProperty()
  acceptedCount: number;

  @ApiProperty()
  rejectedCount: number;

  @ApiProperty()
  pendingCount: number;

  @ApiProperty()
  totalTokensUsed: number;
}
