import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUrl } from 'class-validator';
import { RepoProvider } from '../../../generated/prisma';

export class CreateProjectDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  orgId: string;

  @ApiProperty({ description: 'Project name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Repository URL', example: 'https://github.com/owner/repo' })
  @IsUrl()
  @IsNotEmpty()
  repoUrl: string;

  @ApiProperty({ enum: RepoProvider, description: 'Repository provider' })
  @IsEnum(RepoProvider)
  repoProvider: RepoProvider;

  @ApiPropertyOptional({ description: 'Default branch name', default: 'main' })
  @IsString()
  @IsOptional()
  defaultBranch?: string;

  @ApiPropertyOptional({ description: 'Project settings', type: Object })
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}
