import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsString } from 'class-validator';
import { GenerationType } from '../../../generated/prisma';

export class CreateGenerationDto {
  @ApiProperty({ description: 'Project ID' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ enum: GenerationType, description: 'Type of AI generation' })
  @IsEnum(GenerationType)
  type: GenerationType;

  @ApiProperty({ description: 'Input context for the AI generation', type: Object })
  @IsObject()
  @IsNotEmpty()
  inputContext: Record<string, unknown>;
}
