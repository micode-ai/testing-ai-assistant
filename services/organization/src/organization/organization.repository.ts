import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Organization, Prisma } from '../../generated/prisma';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findFirst({ where: { id, deletedAt: null } });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.prisma.organization.findFirst({ where: { slug, deletedAt: null } });
  }

  async findByUserId(userId: string): Promise<Organization[]> {
    return this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        memberships: { some: { userId, status: 'APPROVED', deletedAt: null } },
      },
    });
  }

  async create(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return this.prisma.organization.create({ data });
  }

  async update(id: string, data: Prisma.OrganizationUpdateInput): Promise<Organization> {
    return this.prisma.organization.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<Organization> {
    return this.prisma.organization.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async countMembers(orgId: string): Promise<number> {
    return this.prisma.orgMembership.count({
      where: { orgId, status: 'APPROVED', deletedAt: null },
    });
  }
}
