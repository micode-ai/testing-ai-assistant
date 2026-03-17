import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ProviderTokenService } from './provider-token.service';
import { RepoProvider } from '../../generated/prisma';

/**
 * Internal controller for inter-service token retrieval.
 * No JWT auth — only accessible within the internal network.
 */
@Controller('api/v1/provider-tokens')
export class ProviderTokenInternalController {
  constructor(private readonly service: ProviderTokenService) {}

  @Public()
  @Get()
  async getToken(
    @Query('orgId') orgId: string,
    @Query('provider') provider: string,
  ) {
    if (!orgId || !provider) {
      throw new NotFoundException('orgId and provider are required');
    }

    const record = await this.service.getToken(
      orgId,
      provider.toUpperCase() as RepoProvider,
    );

    return {
      token: record.token,
      provider: record.provider,
    };
  }
}
