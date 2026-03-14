import { IsString, IsOptional, IsObject, IsInt, Min } from 'class-validator';

export class ReportStepResultDto {
  @IsString()
  status: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsObject()
  @IsOptional()
  details?: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @IsOptional()
  durationMs?: number;

  @IsString()
  @IsOptional()
  completedAt?: string;
}
