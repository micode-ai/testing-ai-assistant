import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel } from '../../../generated/prisma';

export class NotificationConfigEntity {
  @ApiProperty({ description: 'Unique identifier' })
  id: string;

  @ApiProperty({ description: 'Organization ID' })
  orgId: string;

  @ApiProperty({ enum: NotificationChannel, description: 'Notification channel' })
  channel: NotificationChannel;

  @ApiProperty({ description: 'Event name (e.g. run.finished, membership.requested)' })
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
