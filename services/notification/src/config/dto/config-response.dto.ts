import { ApiProperty } from '@nestjs/swagger';
import { NotificationChannel } from '../../../generated/prisma';

export class ConfigResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  id: string;

  @ApiProperty({ description: 'Organization ID' })
  orgId: string;

  @ApiProperty({ enum: NotificationChannel, description: 'Notification channel' })
  channel: NotificationChannel;

  @ApiProperty({ description: 'Event name' })
  event: string;

  @ApiProperty({ description: 'Channel-specific configuration' })
  config: Record<string, unknown>;

  @ApiProperty({ description: 'Whether this notification config is enabled' })
  enabled: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
