import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateChecklistItemDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() expectedBehavior?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() generatedTestCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() section?: string;
}

export class CreateChecklistDto {
  @ApiProperty() @IsString() projectId: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() targetUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateChecklistItemDto)
  items?: CreateChecklistItemDto[];
}
