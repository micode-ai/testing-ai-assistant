import { Injectable, Logger } from '@nestjs/common';
import { OAuthRepository } from './oauth.repository';
import { OAuthAccount, OAuthProvider } from '../../generated/prisma';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(private readonly oauthRepository: OAuthRepository) {}

  async findByProviderAndId(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthAccount | null> {
    return this.oauthRepository.findByProviderAndId(provider, providerUserId);
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    return this.oauthRepository.findByUserId(userId);
  }

  async createOrUpdate(
    userId: string,
    provider: OAuthProvider,
    providerUserId: string,
    accessToken: string,
    refreshToken?: string,
  ): Promise<OAuthAccount> {
    const existing = await this.oauthRepository.findByProviderAndId(provider, providerUserId);

    if (existing) {
      this.logger.log(`Updating OAuth account for provider ${provider}`);
      return this.oauthRepository.update(existing.id, {
        accessToken,
        refreshToken,
      });
    }

    this.logger.log(`Creating OAuth account for provider ${provider}`);
    return this.oauthRepository.create({
      provider,
      providerUserId,
      accessToken,
      refreshToken,
      user: { connect: { id: userId } },
    });
  }
}
