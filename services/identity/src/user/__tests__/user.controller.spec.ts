import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { UserController } from '../user.controller';
import { UserService } from '../user.service';
import { UpdateUserDto } from '../dto/update-user.dto';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed',
    avatarUrl: null,
    keycloakId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockJwtPayload = {
    sub: 'user-1',
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: createMock<UserService>() },
      ],
    }).compile();

    controller = module.get(UserController);
    userService = module.get(UserService);
  });

  describe('getProfile', () => {
    it('should return the current user profile', async () => {
      // Arrange
      userService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await controller.getProfile(mockJwtPayload);

      // Assert
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
    });

    it('should use the sub from JWT payload', async () => {
      // Arrange
      userService.findById.mockResolvedValue(mockUser);

      // Act
      await controller.getProfile(mockJwtPayload);

      // Assert
      expect(userService.findById).toHaveBeenCalledWith('user-1');
    });

    it('should not return sensitive fields like passwordHash', async () => {
      // Arrange
      userService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await controller.getProfile(mockJwtPayload);

      // Assert
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('keycloakId');
    });
  });

  describe('updateProfile', () => {
    it('should update and return the user profile', async () => {
      // Arrange
      const dto: UpdateUserDto = { name: 'Updated Name' };
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      userService.updateProfile.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.updateProfile(mockJwtPayload, dto);

      // Assert
      expect(result.name).toBe('Updated Name');
    });

    it('should call userService.updateProfile with correct args', async () => {
      // Arrange
      const dto: UpdateUserDto = { name: 'New Name', avatarUrl: 'https://example.com/pic.png' };
      userService.updateProfile.mockResolvedValue({ ...mockUser, ...dto });

      // Act
      await controller.updateProfile(mockJwtPayload, dto);

      // Assert
      expect(userService.updateProfile).toHaveBeenCalledWith('user-1', dto);
    });

    it('should propagate errors from service', async () => {
      // Arrange
      const dto: UpdateUserDto = { name: 'x' };
      userService.updateProfile.mockRejectedValue(new Error('Not found'));

      // Act & Assert
      await expect(controller.updateProfile(mockJwtPayload, dto)).rejects.toThrow('Not found');
    });
  });

  describe('deleteAccount', () => {
    it('should delete the current user account', async () => {
      // Arrange
      userService.deleteAccount.mockResolvedValue(undefined);

      // Act
      await controller.deleteAccount(mockJwtPayload);

      // Assert
      expect(userService.deleteAccount).toHaveBeenCalledWith('user-1');
    });

    it('should propagate not found errors', async () => {
      // Arrange
      userService.deleteAccount.mockRejectedValue(new Error('Not found'));

      // Act & Assert
      await expect(controller.deleteAccount(mockJwtPayload)).rejects.toThrow('Not found');
    });

    it('should call deleteAccount with correct user id', async () => {
      // Arrange
      const payload = { sub: 'user-99', email: 'x@y.com', iat: 0, exp: 0 };
      userService.deleteAccount.mockResolvedValue(undefined);

      // Act
      await controller.deleteAccount(payload);

      // Assert
      expect(userService.deleteAccount).toHaveBeenCalledWith('user-99');
    });
  });
});
