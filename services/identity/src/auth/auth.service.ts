import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../user/user.repository';
import { OAuthService } from '../oauth/oauth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { UserRegisteredEvent } from './events/user-registered.event';
import { UserLoggedInEvent } from './events/user-logged-in.event';
import { OAuthProfile } from './interfaces/oauth-profile.interface';
import { AuthTokens } from '@testing-ai/shared-types';
import { addDays } from '@testing-ai/shared-utils';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly oauthService: OAuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepository.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.createRefreshToken(user.id, tokens.refreshToken);

    this.eventEmitter.emit(
      'user.registered',
      new UserRegisteredEvent(user.id, { email: user.email, name: user.name }),
    );

    this.logger.log(`User registered: ${user.id}`);

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(user),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.createRefreshToken(user.id, tokens.refreshToken);

    this.eventEmitter.emit(
      'user.logged_in',
      new UserLoggedInEvent(user.id, { email: user.email, provider: 'credentials' }),
    );

    this.logger.log(`User logged in: ${user.id}`);

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(user),
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!stored || stored.revokedAt || new Date() > stored.expiresAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.revokeRefreshToken(refreshToken);

    const user = await this.userRepository.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.createRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.revokeRefreshToken(refreshToken);
    this.logger.log('User logged out');
  }

  async validateOAuthLogin(profile: OAuthProfile): Promise<AuthResponseDto> {
    let user = await this.userRepository.findByEmail(profile.email);

    if (!user) {
      user = await this.userRepository.create({
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      });

      this.eventEmitter.emit(
        'user.registered',
        new UserRegisteredEvent(user.id, { email: user.email, name: user.name }),
      );
    }

    await this.oauthService.createOrUpdate(
      user.id,
      profile.provider as never,
      profile.providerUserId,
      profile.accessToken,
      profile.refreshToken,
    );

    const tokens = await this.generateTokens(user.id, user.email);
    await this.createRefreshToken(user.id, tokens.refreshToken);

    this.eventEmitter.emit(
      'user.logged_in',
      new UserLoggedInEvent(user.id, { email: user.email, provider: profile.provider }),
    );

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(user),
    };
  }

  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async createRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = addDays(new Date(), 7);
    await this.prisma.refreshToken.create({
      data: { token, userId, expiresAt },
    });
  }

  private async revokeRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }
}
