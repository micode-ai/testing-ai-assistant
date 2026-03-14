import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  MinLength,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class CreatePipelineDto {
  @ApiProperty({ example: 'project-uuid-here' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ example: 'Main CI Pipeline' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: ['PUSH', 'PULL_REQUEST', 'SCHEDULE', 'MANUAL'] })
  @IsEnum(['PUSH', 'PULL_REQUEST', 'SCHEDULE', 'MANUAL'])
  trigger: 'PUSH' | 'PULL_REQUEST' | 'SCHEDULE' | 'MANUAL';

  @ApiPropertyOptional({ example: '0 */6 * * *' })
  @IsString()
  @IsOptional()
  cronExpr?: string;

  @ApiProperty({ example: [{ name: 'lint', command: 'npm run lint' }] })
  @IsArray()
  steps: unknown[];

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
