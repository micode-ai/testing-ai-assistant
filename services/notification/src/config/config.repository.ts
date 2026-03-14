import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { NotificationConfig } from '../../generated/prisma';

@Injectable()
export class ConfigRepository {
  private readonly logger = new Logger(ConfigRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateConfigDto): Promise<NotificationConfig> {
    return this.prisma.notificationConfig.create({
      data: {
        orgId: dto.orgId,
        channel: dto.channel,
        event: dto.event,
        config: (dto.config ?? {}) as any,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async findById(id: string): Promise<NotificationConfig | null> {
    return this.prisma.notificationConfig.findUnique({
      where: { id },
    });
  }

  async findByOrgId(orgId: string): Promise<NotificationConfig[]> {
    return this.prisma.notificationConfig.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByOrgAndEvent(orgId: string, event: string): Promise<NotificationConfig[]> {
    return this.prisma.notificationConfig.findMany({
      where: {
        orgId,
        event,
        enabled: true,
      },
    });
  }

  async update(id: string, dto: UpdateConfigDto): Promise<NotificationConfig> {
    return this.prisma.notificationConfig.update({
      where: { id },
      data: dto as any,
    });
  }

  async delete(id: string): Promise<NotificationConfig> {
    return this.prisma.notificationConfig.delete({
      where: { id },
    });
  }
}
