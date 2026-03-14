import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepoProvider } from '../../../generated/prisma';
import { ProjectEntity } from '../entities/project.entity';

export class ProjectResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orgId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  repoUrl: string;

  @ApiProperty({ enum: RepoProvider })
  repoProvider: RepoProvider;

  @ApiProperty()
  repoOwner: string;

  @ApiProperty()
  repoName: string;

  @ApiProperty()
  defaultBranch: string;

  @ApiPropertyOptional()
  webhookId: string | null;

  @ApiProperty()
  settings: unknown;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: ProjectEntity): ProjectResponseDto {
    const dto = new ProjectResponseDto();
    dto.id = entity.id;
    dto.orgId = entity.orgId;
    dto.name = entity.name;
    dto.repoUrl = entity.repoUrl;
    dto.repoProvider = entity.repoProvider;
    dto.repoOwner = entity.repoOwner;
    dto.repoName = entity.repoName;
    dto.defaultBranch = entity.defaultBranch;
    dto.webhookId = entity.webhookId;
    dto.settings = entity.settings;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
