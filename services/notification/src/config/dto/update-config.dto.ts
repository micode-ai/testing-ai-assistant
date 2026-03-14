import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsBoolean, IsOptional, IsString } from 'class-validator';
import { NotificationChannel } from '../../../generated/prisma';

export class UpdateConfigDto {
  @ApiPropertyOptional({ enum: NotificationChannel, description: 'Notification channel' })
  @IsEnum(NotificationChannel)
  @IsOptional()
  channel?: NotificationChannel;

  @ApiPropertyOptional({ description: 'Event name' })
  @IsString()
  @IsOptional()
  event?: string;

  @ApiPropertyOptional({ description: 'Channel-specific configuration' })
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Whether this notification config is enabled' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
