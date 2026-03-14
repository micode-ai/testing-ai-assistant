import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PipelineResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() projectId: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: ['PUSH', 'PULL_REQUEST', 'SCHEDULE', 'MANUAL'] }) trigger: string;
  @ApiPropertyOptional() cronExpr: string | null;
  @ApiProperty() steps: unknown;
  @ApiProperty() enabled: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() runCount?: number;

  static fromEntity(
    entity: {
      id: string;
      projectId: string;
      name: string;
      trigger: string;
      cronExpr: string | null;
      steps: unknown;
      enabled: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    runCount?: number,
  ): PipelineResponseDto {
    const dto = new PipelineResponseDto();
    dto.id = entity.id;
    dto.projectId = entity.projectId;
    dto.name = entity.name;
    dto.trigger = entity.trigger;
    dto.cronExpr = entity.cronExpr;
    dto.steps = entity.steps;
    dto.enabled = entity.enabled;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    if (runCount !== undefined) dto.runCount = runCount;
    return dto;
  }
}
