import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { OAuthController } from './oauth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { GitLabStrategy } from './strategies/gitlab.strategy';
import { BitbucketStrategy } from './strategies/bitbucket.strategy';
import { UserModule } from '../user/user.module';
import { OAuthModule } from '../oauth/oauth.module';

@Module({
  imports: [
    UserModule,
    OAuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, OAuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, GitHubStrategy, GitLabStrategy, BitbucketStrategy],
  exports: [AuthService],
})
export class AuthModule {}
