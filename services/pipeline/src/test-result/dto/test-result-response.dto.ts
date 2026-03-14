import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TestResultResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() runId: string;
  @ApiProperty() checkType: string;
  @ApiProperty() status: string;
  @ApiProperty() summary: string;
  @ApiProperty() details: unknown;
  @ApiPropertyOptional() artifactUrl: string | null;
  @ApiProperty() durationMs: number;
  @ApiProperty() createdAt: Date;

  static fromEntity(entity: {
    id: string;
    runId: string;
    checkType: string;
    status: string;
    summary: string;
    details: unknown;
    artifactUrl: string | null;
    durationMs: number;
    createdAt: Date;
  }): TestResultResponseDto {
    const dto = new TestResultResponseDto();
    dto.id = entity.id;
    dto.runId = entity.runId;
    dto.checkType = entity.checkType;
    dto.status = entity.status;
    dto.summary = entity.summary;
    dto.details = entity.details;
    dto.artifactUrl = entity.artifactUrl;
    dto.durationMs = entity.durationMs;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
