import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsObject, IsBoolean, IsOptional } from 'class-validator';
import { NotificationChannel } from '../../../generated/prisma';

export class CreateConfigDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  orgId: string;

  @ApiProperty({ enum: NotificationChannel, description: 'Notification channel' })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ description: 'Event name (e.g. run.finished, membership.requested)' })
  @IsString()
  @IsNotEmpty()
  event: string;

  @ApiPropertyOptional({ description: 'Channel-specific configuration', default: {} })
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown> = {};

  @ApiPropertyOptional({ description: 'Whether this notification config is enabled', default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean = true;
}
