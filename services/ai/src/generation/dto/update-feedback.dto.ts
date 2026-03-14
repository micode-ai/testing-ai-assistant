import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateFeedbackDto {
  @ApiProperty({ description: 'Whether the generation was accepted' })
  @IsBoolean()
  accepted: boolean;

  @ApiPropertyOptional({ description: 'Optional feedback text' })
  @IsString()
  @IsOptional()
  feedback?: string;
}
