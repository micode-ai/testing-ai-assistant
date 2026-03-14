import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsInt,
  IsObject,
  Min,
} from 'class-validator';

export class CreateTestResultDto {
  @ApiProperty({ example: 'run-uuid-here' })
  @IsUUID()
  runId: string;

  @ApiProperty({
    enum: [
      'UNIT', 'INTEGRATION', 'E2E', 'LOAD', 'LINT',
      'SAST', 'DAST', 'DEPENDENCY_AUDIT', 'AI_REVIEW',
    ],
  })
  @IsEnum([
    'UNIT', 'INTEGRATION', 'E2E', 'LOAD', 'LINT',
    'SAST', 'DAST', 'DEPENDENCY_AUDIT', 'AI_REVIEW',
  ])
  checkType: string;

  @ApiPropertyOptional({
    enum: ['PENDING', 'RUNNING', 'PASSED', 'FAILED', 'SKIPPED', 'CANCELLED'],
    default: 'PENDING',
  })
  @IsEnum(['PENDING', 'RUNNING', 'PASSED', 'FAILED', 'SKIPPED', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'All 42 tests passed' })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiPropertyOptional({ example: {} })
  @IsObject()
  @IsOptional()
  details?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'https://artifacts.example.com/report.html' })
  @IsString()
  @IsOptional()
  artifactUrl?: string;

  @ApiPropertyOptional({ example: 12345 })
  @IsInt()
  @Min(0)
  @IsOptional()
  durationMs?: number;
}
