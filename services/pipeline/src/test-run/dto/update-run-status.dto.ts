import { IsString, IsOptional } from 'class-validator';

export class UpdateRunStatusDto {
  @IsString()
  status: string;

  @IsString()
  @IsOptional()
  startedAt?: string;

  @IsString()
  @IsOptional()
  completedAt?: string;
}
