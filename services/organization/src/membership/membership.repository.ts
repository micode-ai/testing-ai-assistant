import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgMembership, Prisma } from '../../generated/prisma';

@Injectable()
export class MembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<OrgMembership | null> {
    return this.prisma.orgMembership.findFirst({ where: { id, deletedAt: null } });
  }

  async findByUserAndOrg(userId: string, orgId: string): Promise<OrgMembership | null> {
    return this.prisma.orgMembership.findFirst({ where: { userId, orgId, deletedAt: null } });
  }

  async findByOrgId(orgId: string): Promise<OrgMembership[]> {
    return this.prisma.orgMembership.findMany({ where: { orgId, deletedAt: null } });
  }

  async create(data: Prisma.OrgMembershipUncheckedCreateInput): Promise<OrgMembership> {
    return this.prisma.orgMembership.create({ data });
  }

  async update(id: string, data: Prisma.OrgMembershipUpdateInput): Promise<OrgMembership> {
    return this.prisma.orgMembership.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<OrgMembership> {
    return this.prisma.orgMembership.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async countAdmins(orgId: string): Promise<number> {
    return this.prisma.orgMembership.count({
      where: { orgId, role: 'ADMIN', status: 'APPROVED', deletedAt: null },
    });
  }
}
