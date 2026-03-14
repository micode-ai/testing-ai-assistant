import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OAuthAccount, OAuthProvider, Prisma } from '../../generated/prisma';

@Injectable()
export class OAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProviderAndId(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthAccount | null> {
    return this.prisma.oAuthAccount.findFirst({
      where: { provider, providerUserId, deletedAt: null },
    });
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    return this.prisma.oAuthAccount.findMany({
      where: { userId, deletedAt: null },
    });
  }

  async create(data: Prisma.OAuthAccountCreateInput): Promise<OAuthAccount> {
    return this.prisma.oAuthAccount.create({ data });
  }

  async update(id: string, data: Prisma.OAuthAccountUpdateInput): Promise<OAuthAccount> {
    return this.prisma.oAuthAccount.update({
      where: { id },
      data,
    });
  }
}
