import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-bitbucket-oauth20';
import { AuthService } from '../auth.service';
import { OAuthProfile } from '../interfaces/oauth-profile.interface';
import { AuthResponseDto } from '../dto/auth-response.dto';

@Injectable()
export class BitbucketStrategy extends PassportStrategy(Strategy, 'bitbucket') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      clientID: configService.get<string>('BITBUCKET_CLIENT_ID') || 'not-configured',
      clientSecret: configService.get<string>('BITBUCKET_CLIENT_SECRET') || 'not-configured',
      callbackURL: configService.get<string>('BITBUCKET_CALLBACK_URL') || 'http://localhost:3001/auth/bitbucket/callback',
      scope: ['account'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<AuthResponseDto> {
    const email =
      profile.emails && profile.emails.length > 0
        ? profile.emails[0].value
        : '';

    const oauthProfile: OAuthProfile = {
      provider: 'bitbucket',
      providerUserId: profile.id,
      email,
      name: profile.displayName || profile.username || '',
      avatarUrl: profile.photos?.[0]?.value,
      accessToken,
      refreshToken,
    };

    return this.authService.validateOAuthLogin(oauthProfile);
  }
}
