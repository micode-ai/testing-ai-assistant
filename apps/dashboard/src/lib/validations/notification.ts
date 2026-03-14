import { z } from 'zod';

export const notificationConfigSchema = z.object({
  channel: z.enum(['EMAIL', 'SLACK', 'TELEGRAM']),
  event: z.string().min(1, 'Event type is required'),
  config: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

export type NotificationConfigInput = z.infer<typeof notificationConfigSchema>;
