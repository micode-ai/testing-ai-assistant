import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { OAuthService } from '../oauth.service';
import { OAuthRepository } from '../oauth.repository';
import { OAuthProvider } from '../../../generated/prisma';

describe('OAuthService', () => {
  let service: OAuthService;
  let oauthRepository: jest.Mocked<OAuthRepository>;

  const mockOAuthAccount = {
    id: 'oauth-1',
    provider: 'GITHUB' as OAuthProvider,
    providerUserId: 'gh-123',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: null,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        { provide: OAuthRepository, useValue: createMock<OAuthRepository>() },
      ],
    }).compile();

    service = module.get(OAuthService);
    oauthRepository = module.get(OAuthRepository);
  });

  describe('findByProviderAndId', () => {
    it('should return an OAuth account when found', async () => {
      // Arrange
      oauthRepository.findByProviderAndId.mockResolvedValue(mockOAuthAccount);

      // Act
      const result = await service.findByProviderAndId('GITHUB' as OAuthProvider, 'gh-123');

      // Assert
      expect(result).toEqual(mockOAuthAccount);
      expect(oauthRepository.findByProviderAndId).toHaveBeenCalledWith('GITHUB', 'gh-123');
    });

    it('should return null when OAuth account not found', async () => {
      // Arrange
      oauthRepository.findByProviderAndId.mockResolvedValue(null);

      // Act
      const result = await service.findByProviderAndId('GITLAB' as OAuthProvider, 'gl-999');

      // Assert
      expect(result).toBeNull();
    });

    it('should pass correct provider and id to repository', async () => {
      // Arrange
      oauthRepository.findByProviderAndId.mockResolvedValue(null);

      // Act
      await service.findByProviderAndId('BITBUCKET' as OAuthProvider, 'bb-456');

      // Assert
      expect(oauthRepository.findByProviderAndId).toHaveBeenCalledWith('BITBUCKET', 'bb-456');
    });
  });

  describe('findByUserId', () => {
    it('should return all OAuth accounts for a user', async () => {
      // Arrange
      oauthRepository.findByUserId.mockResolvedValue([mockOAuthAccount]);

      // Act
      const result = await service.findByUserId('user-1');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockOAuthAccount);
    });

    it('should return empty array when no accounts found', async () => {
      // Arrange
      oauthRepository.findByUserId.mockResolvedValue([]);

      // Act
      const result = await service.findByUserId('user-no-oauth');

      // Assert
      expect(result).toEqual([]);
    });

    it('should pass userId to repository', async () => {
      // Arrange
      oauthRepository.findByUserId.mockResolvedValue([]);

      // Act
      await service.findByUserId('user-42');

      // Assert
      expect(oauthRepository.findByUserId).toHaveBeenCalledWith('user-42');
    });
  });

  describe('createOrUpdate', () => {
    it('should create a new OAuth account when none exists', async () => {
      // Arrange
      oauthRepository.findByProviderAndId.mockResolvedValue(null);
      oauthRepository.create.mockResolvedValue(mockOAuthAccount);

      // Act
      const result = await service.createOrUpdate(
        'user-1',
        'GITHUB' as OAuthProvider,
        'gh-123',
        'new-access-token',
        'new-refresh-token',
      );

      // Assert
      expect(result).toEqual(mockOAuthAccount);
      expect(oauthRepository.create).toHaveBeenCalledWith({
        provider: 'GITHUB',
        providerUserId: 'gh-123',
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: { connect: { id: 'user-1' } },
      });
    });

    it('should update an existing OAuth account', async () => {
      // Arrange
      oauthRepository.findByProviderAndId.mockResolvedValue(mockOAuthAccount);
      const updatedAccount = { ...mockOAuthAccount, accessToken: 'updated-token' };
      oauthRepository.update.mockResolvedValue(updatedAccount);

      // Act
      const result = await service.createOrUpdate(
        'user-1',
        'GITHUB' as OAuthProvider,
        'gh-123',
        'updated-token',
        'updated-refresh',
      );

      // Assert
      expect(result.accessToken).toBe('updated-token');
      expect(oauthRepository.update).toHaveBeenCalledWith('oauth-1', {
        accessToken: 'updated-token',
        refreshToken: 'updated-refresh',
      });
      expect(oauthRepository.create).not.toHaveBeenCalled();
    });

    it('should handle createOrUpdate without refresh token', async () => {
      // Arrange
      oauthRepository.findByProviderAndId.mockResolvedValue(null);
      oauthRepository.create.mockResolvedValue({ ...mockOAuthAccount, refreshToken: null });

      // Act
      const result = await service.createOrUpdate(
        'user-1',
        'GITHUB' as OAuthProvider,
        'gh-123',
        'access-token',
      );

      // Assert
      expect(result).toBeDefined();
      expect(oauthRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'access-token',
          refreshToken: undefined,
        }),
      );
    });
  });
});
