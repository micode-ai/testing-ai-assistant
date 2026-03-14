import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigRepository } from './config.repository';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { NotificationConfig } from '../../generated/prisma';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  constructor(private readonly configRepository: ConfigRepository) {}

  async create(dto: CreateConfigDto): Promise<NotificationConfig> {
    this.logger.log(`Creating notification config for org ${dto.orgId}, channel ${dto.channel}, event ${dto.event}`);
    return this.configRepository.create(dto);
  }

  async findByOrg(orgId: string): Promise<NotificationConfig[]> {
    return this.configRepository.findByOrgId(orgId);
  }

  async findById(id: string): Promise<NotificationConfig> {
    const config = await this.configRepository.findById(id);
    if (!config) {
      throw new NotFoundException(`Notification config with ID ${id} not found`);
    }
    return config;
  }

  async update(id: string, dto: UpdateConfigDto): Promise<NotificationConfig> {
    await this.findById(id);
    this.logger.log(`Updating notification config ${id}`);
    return this.configRepository.update(id, dto);
  }

  async delete(id: string): Promise<NotificationConfig> {
    await this.findById(id);
    this.logger.log(`Deleting notification config ${id}`);
    return this.configRepository.delete(id);
  }

  async findConfigsForEvent(orgId: string, event: string): Promise<NotificationConfig[]> {
    return this.configRepository.findByOrgAndEvent(orgId, event);
  }
}
