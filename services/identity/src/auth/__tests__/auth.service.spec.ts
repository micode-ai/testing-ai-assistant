import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { UserRepository } from '../../user/user.repository';
import { OAuthService } from '../../oauth/oauth.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let prismaService: jest.Mocked<PrismaService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: '$2a$10$hashedpassword',
    avatarUrl: null,
    keycloakId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: createMock<UserRepository>() },
        { provide: OAuthService, useValue: createMock<OAuthService>() },
        { provide: JwtService, useValue: createMock<JwtService>() },
        { provide: ConfigService, useValue: createMock<ConfigService>() },
        { provide: EventEmitter2, useValue: createMock<EventEmitter2>() },
        { provide: PrismaService, useValue: createMock<PrismaService>() },
      ],
    }).compile();

    service = module.get(AuthService);
    userRepository = module.get(UserRepository);
    jwtService = module.get(JwtService);
    prismaService = module.get(PrismaService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      // Arrange
      const dto = { email: 'test@example.com', name: 'Test', password: 'password123' };
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue('token');

      // Act
      const result = await service.register(dto);

      // Assert
      expect(result.user.email).toBe(dto.email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(userRepository.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists', async () => {
      // Arrange
      const dto = { email: 'existing@example.com', name: 'Test', password: 'password123' };
      userRepository.findByEmail.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should emit user.registered event on successful registration', async () => {
      // Arrange
      const dto = { email: 'test@example.com', name: 'Test', password: 'password123' };
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue('token');

      // Act
      await service.register(dto);

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.registered',
        expect.objectContaining({ aggregateId: mockUser.id }),
      );
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for non-existent user', async () => {
      // Arrange
      const dto = { email: 'none@example.com', password: 'pass' };
      userRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for user without password hash', async () => {
      // Arrange
      const dto = { email: 'test@example.com', password: 'pass' };
      userRepository.findByEmail.mockResolvedValue({ ...mockUser, passwordHash: null });

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      // Arrange
      const dto = { email: 'test@example.com', password: 'wrongpassword' };
      userRepository.findByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: '$2a$10$invalidhash',
      });

      // Act & Assert
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException for invalid refresh token', async () => {
      // Arrange
      (prismaService.refreshToken as any) = {
        findUnique: jest.fn().mockResolvedValue(null),
      };

      // Act & Assert
      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for revoked refresh token', async () => {
      // Arrange
      (prismaService.refreshToken as any) = {
        findUnique: jest.fn().mockResolvedValue({
          token: 'revoked-token',
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          userId: 'user-1',
        }),
      };

      // Act & Assert
      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      // Arrange
      (prismaService.refreshToken as any) = {
        findUnique: jest.fn().mockResolvedValue({
          token: 'expired-token',
          revokedAt: null,
          expiresAt: new Date(Date.now() - 86400000),
          userId: 'user-1',
        }),
      };

      // Act & Assert
      await expect(service.refreshTokens('expired-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke the refresh token', async () => {
      // Arrange
      (prismaService.refreshToken as any) = {
        update: jest.fn().mockResolvedValue({}),
      };

      // Act
      await service.logout('valid-token');

      // Assert
      expect(prismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { token: 'valid-token' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
