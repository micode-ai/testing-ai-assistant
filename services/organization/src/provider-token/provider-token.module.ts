import { Module } from '@nestjs/common';
import { ProviderTokenController } from './provider-token.controller';
import { ProviderTokenInternalController } from './provider-token-internal.controller';
import { ProviderTokenService } from './provider-token.service';
import { ProviderTokenRepository } from './provider-token.repository';

@Module({
  controllers: [ProviderTokenController, ProviderTokenInternalController],
  providers: [ProviderTokenService, ProviderTokenRepository],
  exports: [ProviderTokenService],
})
export class ProviderTokenModule {}
