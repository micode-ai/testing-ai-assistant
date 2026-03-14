import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateTestRunDto {
  @ApiProperty({ example: 'pipeline-uuid-here' })
  @IsUUID()
  pipelineId: string;

  @ApiProperty({ example: 'abc123def456' })
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  commitSha: string;

  @ApiProperty({ example: 'main' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  branch: string;

  @ApiPropertyOptional({ example: 'user-uuid-here' })
  @IsString()
  @IsOptional()
  triggeredBy?: string;
}
