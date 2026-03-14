import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TestResultSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() checkType: string;
  @ApiProperty() status: string;
  @ApiProperty() summary: string;
  @ApiProperty() durationMs: number;
  @ApiPropertyOptional() artifactUrl: string | null;
  @ApiPropertyOptional() details: Record<string, unknown> | null;
  @ApiPropertyOptional() createdAt: Date;
}

export class TestRunResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() pipelineId: string;
  @ApiProperty() commitSha: string;
  @ApiProperty() branch: string;
  @ApiProperty({ enum: ['QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'ERRORED', 'CANCELLED'] })
  status: string;
  @ApiPropertyOptional() startedAt: Date | null;
  @ApiPropertyOptional() finishedAt: Date | null;
  @ApiPropertyOptional() triggeredBy: string | null;
  @ApiProperty() metadata: unknown;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional({ type: [TestResultSummaryDto] }) results?: TestResultSummaryDto[];

  static fromEntity(
    entity: {
      id: string;
      pipelineId: string;
      commitSha: string;
      branch: string;
      status: string;
      startedAt: Date | null;
      finishedAt: Date | null;
      triggeredBy: string | null;
      metadata: unknown;
      createdAt: Date;
      results?: {
        id: string;
        checkType: string;
        status: string;
        summary: string;
        durationMs: number;
        artifactUrl: string | null;
        details: unknown;
        createdAt: Date;
      }[];
    },
  ): TestRunResponseDto {
    const dto = new TestRunResponseDto();
    dto.id = entity.id;
    dto.pipelineId = entity.pipelineId;
    dto.commitSha = entity.commitSha;
    dto.branch = entity.branch;
    dto.status = entity.status;
    dto.startedAt = entity.startedAt;
    dto.finishedAt = entity.finishedAt;
    dto.triggeredBy = entity.triggeredBy;
    dto.metadata = entity.metadata;
    dto.createdAt = entity.createdAt;

    if (entity.results) {
      dto.results = entity.results.map((r) => ({
        id: r.id,
        checkType: r.checkType,
        status: r.status,
        summary: r.summary,
        durationMs: r.durationMs,
        artifactUrl: r.artifactUrl,
        details: (r.details as Record<string, unknown>) ?? null,
        createdAt: r.createdAt,
      }));
    }

    return dto;
  }
}
