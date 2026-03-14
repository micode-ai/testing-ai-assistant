import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChecklistItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() checklistId: string;
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty() expectedBehavior: string;
  @ApiProperty() priority: string;
  @ApiProperty() order: number;
  @ApiPropertyOptional() generatedTestCode: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class ChecklistItemResultResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() runId: string;
  @ApiProperty() itemId: string;
  @ApiProperty() status: string;
  @ApiProperty() summary: string;
  @ApiProperty() details: unknown;
  @ApiProperty() screenshots: unknown;
  @ApiProperty() durationMs: number;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional() item?: ChecklistItemResponseDto;
}

export class ChecklistRunResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() checklistId: string;
  @ApiProperty() targetUrl: string;
  @ApiProperty() status: string;
  @ApiPropertyOptional() triggeredBy: string | null;
  @ApiPropertyOptional() startedAt: Date | null;
  @ApiPropertyOptional() finishedAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional() itemResults?: ChecklistItemResultResponseDto[];
}

export class ChecklistResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() projectId: string;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiPropertyOptional() targetUrl: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() items?: ChecklistItemResponseDto[];
  @ApiPropertyOptional() runs?: ChecklistRunResponseDto[];
}

export class ChecklistExportDto {
  @ApiProperty() version: string;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiPropertyOptional() targetUrl: string | null;
  @ApiProperty() items: {
    title: string;
    description: string;
    expectedBehavior: string;
    priority: string;
    generatedTestCode: string | null;
  }[];
}
