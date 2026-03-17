import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RepoProvider } from '../../generated/prisma';

@Injectable()
export class ProviderTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrgAndProvider(orgId: string, provider: RepoProvider) {
    return this.prisma.providerToken.findUnique({
      where: { orgId_provider: { orgId, provider } },
    });
  }

  async findByOrg(orgId: string) {
    return this.prisma.providerToken.findMany({
      where: { orgId },
    });
  }

  async upsert(orgId: string, provider: RepoProvider, token: string, label?: string) {
    return this.prisma.providerToken.upsert({
      where: { orgId_provider: { orgId, provider } },
      create: { orgId, provider, token, label },
      update: { token, label },
    });
  }

  async delete(orgId: string, provider: RepoProvider) {
    return this.prisma.providerToken.delete({
      where: { orgId_provider: { orgId, provider } },
    });
  }
}
