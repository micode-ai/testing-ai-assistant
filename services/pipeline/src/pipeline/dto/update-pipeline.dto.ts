import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdatePipelineDto {
  @ApiPropertyOptional({ example: 'Updated Pipeline Name' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: ['PUSH', 'PULL_REQUEST', 'SCHEDULE', 'MANUAL'] })
  @IsEnum(['PUSH', 'PULL_REQUEST', 'SCHEDULE', 'MANUAL'])
  @IsOptional()
  trigger?: 'PUSH' | 'PULL_REQUEST' | 'SCHEDULE' | 'MANUAL';

  @ApiPropertyOptional({ example: '0 */6 * * *' })
  @IsString()
  @IsOptional()
  cronExpr?: string;

  @ApiPropertyOptional({ example: [{ name: 'lint', command: 'npm run lint' }] })
  @IsArray()
  @IsOptional()
  steps?: unknown[];

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
