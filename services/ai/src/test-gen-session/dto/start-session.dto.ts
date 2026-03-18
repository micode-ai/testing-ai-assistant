import { IsString, IsOptional } from 'class-validator';

export class StartSessionDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

export class GenerateProposalDto {
  @IsOptional()
  @IsString()
  focusArea?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

export class ApproveProposalDto {
  @IsString({ each: true })
  approvedItemIds: string[];
}

export class UpdateTestsDto {
  tests: Array<{ path: string; content: string }>;
}

export class RegenerateTestsDto {
  @IsString({ each: true })
  itemIds: string[];

  @IsOptional()
  @IsString()
  locale?: string;
}

export class CommitTestsDto {
  @IsOptional()
  createPR?: boolean;

  @IsOptional()
  @IsString()
  commitMessage?: string;
}
