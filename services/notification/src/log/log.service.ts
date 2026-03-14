import { Injectable, Logger } from '@nestjs/common';
import { LogRepository } from './log.repository';
import { NotificationLog, NotificationStatus } from '../../generated/prisma';

@Injectable()
export class LogService {
  private readonly logger = new Logger(LogService.name);

  constructor(private readonly logRepository: LogRepository) {}

  async logNotification(configId: string, payload: Record<string, unknown>): Promise<NotificationLog> {
    this.logger.debug(`Logging notification for config ${configId}`);
    return this.logRepository.create(configId, payload);
  }

  async getLogsByConfig(configId: string): Promise<NotificationLog[]> {
    return this.logRepository.findByConfigId(configId);
  }

  async updateStatus(id: string, status: string, error?: string): Promise<NotificationLog> {
    return this.logRepository.updateStatus(id, status as NotificationStatus, error);
  }
}
