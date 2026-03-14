import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationConfig } from '../../generated/prisma';
import { ConfigService } from '../config/config.service';
import { LogService } from '../log/log.service';
import { EmailSender } from './channels/email.sender';
import { SlackSender } from './channels/slack.sender';
import { TelegramSender } from './channels/telegram.sender';
import { PushSender } from './channels/push.sender';

export interface NotificationEvent {
  orgId: string;
  event: string;
  data: Record<string, unknown>;
}

@Injectable()
export class SenderService {
  private readonly logger = new Logger(SenderService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly logService: LogService,
    private readonly emailSender: EmailSender,
    private readonly slackSender: SlackSender,
    private readonly telegramSender: TelegramSender,
    private readonly pushSender: PushSender,
  ) {}

  async processEvent(notificationEvent: NotificationEvent): Promise<void> {
    const { orgId, event, data } = notificationEvent;

    this.logger.log(`Processing event "${event}" for org ${orgId}`);

    const configs = await this.configService.findConfigsForEvent(orgId, event);

    if (configs.length === 0) {
      this.logger.log(`No notification configs found for org ${orgId}, event "${event}"`);
      return;
    }

    const results = await Promise.allSettled(
      configs.map((config) => this.dispatchToChannel(config, { event, data })),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Failed to send notification via ${configs[index].channel} for event "${event}": ${result.reason}`,
        );
      }
    });
  }

  private async dispatchToChannel(
    config: NotificationConfig,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const channelConfig = config.config as Record<string, unknown>;
    const logEntry = await this.logService.logNotification(config.id, payload);

    try {
      switch (config.channel) {
        case NotificationChannel.EMAIL:
          await this.emailSender.send(channelConfig, payload);
          break;
        case NotificationChannel.SLACK:
          await this.slackSender.send(channelConfig, payload);
          break;
        case NotificationChannel.TELEGRAM:
          await this.telegramSender.send(channelConfig, payload);
          break;
        case NotificationChannel.PUSH:
          await this.pushSender.send(channelConfig, payload);
          break;
        default:
          this.logger.warn(`Unknown notification channel: ${config.channel}`);
          await this.logService.updateStatus(logEntry.id, 'FAILED', `Unknown channel: ${config.channel}`);
          return;
      }

      await this.logService.updateStatus(logEntry.id, 'SENT');
      this.logger.log(`Notification sent via ${config.channel} for event "${payload.event}"`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logService.updateStatus(logEntry.id, 'FAILED', errorMessage);
      this.logger.error(`Failed to send ${config.channel} notification: ${errorMessage}`);
      throw error;
    }
  }
}
