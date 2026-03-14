import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserService } from '../user.service';
import { UserRepository } from '../user.repository';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<UserRepository>;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: createMock<UserRepository>() },
        { provide: EventEmitter2, useValue: createMock<EventEmitter2>() },
      ],
    }).compile();

    service = module.get(UserService);
    userRepository = module.get(UserRepository);
  });

  describe('findById', () => {
    it('should return a user when found', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.findById('user-1');

      // Assert
      expect(result).toEqual(mockUser);
      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with correct message', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('missing')).rejects.toThrow('User not found');
    });
  });

  describe('findByEmail', () => {
    it('should return a user when found by email', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(mockUser);

      // Act
      const result = await service.findByEmail('test@example.com');

      // Assert
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by email', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(null);

      // Act
      const result = await service.findByEmail('nonexistent@example.com');

      // Assert
      expect(result).toBeNull();
    });

    it('should pass the email to the repository', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(null);

      // Act
      await service.findByEmail('search@test.com');

      // Assert
      expect(userRepository.findByEmail).toHaveBeenCalledWith('search@test.com');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      // Arrange
      const dto = { name: 'Updated Name' };
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await service.updateProfile('user-1', dto);

      // Assert
      expect(result.name).toBe('Updated Name');
      expect(userRepository.update).toHaveBeenCalledWith('user-1', dto);
    });

    it('should throw NotFoundException when user to update does not exist', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateProfile('nonexistent', { name: 'New' })).rejects.toThrow(NotFoundException);
    });

    it('should update avatar URL when provided', async () => {
      // Arrange
      const dto = { avatarUrl: 'https://example.com/new-avatar.png' };
      const updatedUser = { ...mockUser, avatarUrl: dto.avatarUrl };
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await service.updateProfile('user-1', dto);

      // Assert
      expect(result.avatarUrl).toBe(dto.avatarUrl);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('deleteAccount', () => {
    it('should soft delete user account successfully', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.softDelete.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      // Act
      await service.deleteAccount('user-1');

      // Assert
      expect(userRepository.softDelete).toHaveBeenCalledWith('user-1');
    });

    it('should throw NotFoundException when user to delete does not exist', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteAccount('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should call findById before attempting delete', async () => {
      // Arrange
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.softDelete.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      // Act
      await service.deleteAccount('user-1');

      // Assert
      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
      expect(userRepository.findById).toHaveBeenCalledBefore(userRepository.softDelete);
    });
  });
});
