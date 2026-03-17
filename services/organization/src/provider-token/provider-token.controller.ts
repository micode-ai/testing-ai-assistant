import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsIn, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProviderTokenService } from './provider-token.service';
import { RepoProvider } from '../../generated/prisma';

class UpsertProviderTokenDto {
  @IsString()
  @IsIn(['GITHUB', 'GITLAB', 'BITBUCKET'])
  provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET';

  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  label?: string;
}

@Controller('organizations/:orgId/provider-tokens')
@UseGuards(JwtAuthGuard)
export class ProviderTokenController {
  constructor(private readonly service: ProviderTokenService) {}

  @Get()
  async list(@Param('orgId') orgId: string) {
    return this.service.getTokensForOrg(orgId);
  }

  @Post()
  async upsert(
    @Param('orgId') orgId: string,
    @Body() dto: UpsertProviderTokenDto,
  ) {
    await this.service.upsertToken(
      orgId,
      dto.provider as RepoProvider,
      dto.token,
      dto.label,
    );
    return { success: true, provider: dto.provider };
  }

  @Delete(':provider')
  async remove(
    @Param('orgId') orgId: string,
    @Param('provider') provider: string,
  ) {
    await this.service.deleteToken(orgId, provider.toUpperCase() as RepoProvider);
    return { success: true };
  }
}
