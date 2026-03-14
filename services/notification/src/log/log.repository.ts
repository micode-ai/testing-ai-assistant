import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationLog, NotificationStatus } from '../../generated/prisma';

@Injectable()
export class LogRepository {
  private readonly logger = new Logger(LogRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(configId: string, payload: Record<string, unknown>): Promise<NotificationLog> {
    return this.prisma.notificationLog.create({
      data: {
        configId,
        payload: payload as any,
        status: NotificationStatus.PENDING,
      },
    });
  }

  async findByConfigId(configId: string): Promise<NotificationLog[]> {
    return this.prisma.notificationLog.findMany({
      where: { configId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    id: string,
    status: NotificationStatus,
    error?: string,
  ): Promise<NotificationLog> {
    return this.prisma.notificationLog.update({
      where: { id },
      data: {
        status,
        error,
        sentAt: status === NotificationStatus.SENT ? new Date() : undefined,
      },
    });
  }
}
