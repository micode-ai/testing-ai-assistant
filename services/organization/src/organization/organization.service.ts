import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Organization } from '../../generated/prisma';
import { OrganizationRepository } from './organization.repository';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationCreatedEvent } from './events/organization-created.event';
import { OrganizationUpdatedEvent } from './events/organization-updated.event';
import { generateSlug } from '@testing-ai/shared-utils';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  async create(userId: string, dto: CreateOrganizationDto): Promise<Organization> {
    const slug = generateSlug(dto.name);
    const existing = await this.organizationRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictException('Organization with this name already exists');
    }

    const org = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.name, slug },
      });

      await tx.orgMembership.create({
        data: {
          userId,
          orgId: organization.id,
          role: 'ADMIN',
          status: 'APPROVED',
          resolvedAt: new Date(),
        },
      });

      return organization;
    });

    this.eventEmitter.emit(
      'organization.created',
      new OrganizationCreatedEvent(org.id, {
        name: org.name,
        slug: org.slug,
        creatorUserId: userId,
      }),
    );

    this.logger.log(`Organization created: ${org.id} by user ${userId}`);
    return org;
  }

  async findByUser(userId: string): Promise<Organization[]> {
    return this.organizationRepository.findByUserId(userId);
  }

  async findById(id: string): Promise<Organization> {
    const org = await this.organizationRepository.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    await this.findById(id);

    const updateData: Record<string, unknown> = {};
    if (dto.name) {
      updateData.name = dto.name;
      updateData.slug = generateSlug(dto.name);

      const existing = await this.organizationRepository.findBySlug(updateData.slug as string);
      if (existing && existing.id !== id) {
        throw new ConflictException('Organization with this name already exists');
      }
    }

    const updated = await this.organizationRepository.update(id, updateData);

    this.eventEmitter.emit(
      'organization.updated',
      new OrganizationUpdatedEvent(id, updateData),
    );

    this.logger.log(`Organization updated: ${id}`);
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    await this.findById(id);
    await this.organizationRepository.softDelete(id);
    this.logger.log(`Organization deleted: ${id}`);
  }

  async getMemberCount(orgId: string): Promise<number> {
    return this.organizationRepository.countMembers(orgId);
  }
}
