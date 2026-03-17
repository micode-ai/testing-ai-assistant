import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProviderTokenRepository } from './provider-token.repository';
import { RepoProvider } from '../../generated/prisma';

@Injectable()
export class ProviderTokenService {
  private readonly logger = new Logger(ProviderTokenService.name);

  constructor(private readonly repository: ProviderTokenRepository) {}

  async getTokensForOrg(orgId: string) {
    const tokens = await this.repository.findByOrg(orgId);
    // Return without exposing full token
    return tokens.map((t) => ({
      id: t.id,
      provider: t.provider,
      label: t.label,
      hasToken: true,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async getToken(orgId: string, provider: RepoProvider) {
    const record = await this.repository.findByOrgAndProvider(orgId, provider);
    if (!record) {
      throw new NotFoundException(
        `No ${provider} token configured for this organization`,
      );
    }
    return record;
  }

  async upsertToken(orgId: string, provider: RepoProvider, token: string, label?: string) {
    this.logger.log(`Upserting ${provider} token for org ${orgId}`);
    return this.repository.upsert(orgId, provider, token, label);
  }

  async deleteToken(orgId: string, provider: RepoProvider) {
    this.logger.log(`Deleting ${provider} token for org ${orgId}`);
    return this.repository.delete(orgId, provider);
  }
}
