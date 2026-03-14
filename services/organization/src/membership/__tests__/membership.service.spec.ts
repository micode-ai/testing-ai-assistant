import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MembershipService } from '../membership.service';
import { MembershipRepository } from '../membership.repository';

describe('MembershipService', () => {
  let service: MembershipService;
  let repository: MembershipRepository;
  let eventEmitter: EventEmitter2;

  const mockMembership = {
    id: 'mem-1',
    userId: 'user-2',
    orgId: 'org-1',
    role: 'MEMBER' as const,
    status: 'PENDING' as const,
    requestedAt: new Date(),
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockAdminMembership = {
    ...mockMembership,
    id: 'mem-admin',
    userId: 'user-1',
    role: 'ADMIN' as const,
    status: 'APPROVED' as const,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipService,
        { provide: MembershipRepository, useValue: createMock<MembershipRepository>() },
        { provide: EventEmitter2, useValue: createMock<EventEmitter2>() },
      ],
    }).compile();

    service = module.get<MembershipService>(MembershipService);
    repository = module.get<MembershipRepository>(MembershipRepository);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('invite', () => {
    it('should invite a new member', async () => {
      // Arrange
      jest.spyOn(repository, 'findByUserAndOrg').mockResolvedValue(null);
      jest.spyOn(repository, 'create').mockResolvedValue(mockMembership);

      // Act
      const result = await service.invite('org-1', 'user-1', { userId: 'user-2' });

      // Assert
      expect(result).toEqual(mockMembership);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'member.invited',
        expect.objectContaining({ aggregateId: 'mem-1' }),
      );
    });

    it('should throw ConflictException when user already has membership', async () => {
      // Arrange
      jest.spyOn(repository, 'findByUserAndOrg').mockResolvedValue(mockMembership);

      // Act & Assert
      await expect(service.invite('org-1', 'user-1', { userId: 'user-2' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('approve', () => {
    it('should approve a pending membership', async () => {
      // Arrange
      const approved = { ...mockMembership, status: 'APPROVED' as const, resolvedAt: new Date() };
      jest.spyOn(repository, 'findById').mockResolvedValue(mockMembership);
      jest.spyOn(repository, 'update').mockResolvedValue(approved);

      // Act
      const result = await service.approve('org-1', 'mem-1', 'user-1');

      // Assert
      expect(result.status).toBe('APPROVED');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'member.approved',
        expect.objectContaining({ aggregateId: 'mem-1' }),
      );
    });

    it('should throw ConflictException when membership is not pending', async () => {
      // Arrange
      const approved = { ...mockMembership, status: 'APPROVED' as const };
      jest.spyOn(repository, 'findById').mockResolvedValue(approved);

      // Act & Assert
      await expect(service.approve('org-1', 'mem-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('reject', () => {
    it('should reject a pending membership', async () => {
      // Arrange
      const rejected = { ...mockMembership, status: 'REJECTED' as const, resolvedAt: new Date() };
      jest.spyOn(repository, 'findById').mockResolvedValue(mockMembership);
      jest.spyOn(repository, 'update').mockResolvedValue(rejected);

      // Act
      const result = await service.reject('org-1', 'mem-1', 'user-1');

      // Assert
      expect(result.status).toBe('REJECTED');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'member.rejected',
        expect.objectContaining({ aggregateId: 'mem-1' }),
      );
    });

    it('should throw ConflictException when membership is not pending', async () => {
      // Arrange
      const approved = { ...mockMembership, status: 'APPROVED' as const };
      jest.spyOn(repository, 'findById').mockResolvedValue(approved);

      // Act & Assert
      await expect(service.reject('org-1', 'mem-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('changeRole', () => {
    it('should change the role of a member', async () => {
      // Arrange
      const updated = { ...mockMembership, role: 'VIEWER' as const, status: 'APPROVED' as const };
      jest.spyOn(repository, 'findById').mockResolvedValue({
        ...mockMembership,
        status: 'APPROVED' as const,
      });
      jest.spyOn(repository, 'update').mockResolvedValue(updated);

      // Act
      const result = await service.changeRole('org-1', 'mem-1', 'VIEWER');

      // Assert
      expect(result.role).toBe('VIEWER');
    });

    it('should throw ForbiddenException when demoting the last admin', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(mockAdminMembership);
      jest.spyOn(repository, 'countAdmins').mockResolvedValue(1);

      // Act & Assert
      await expect(
        service.changeRole('org-1', 'mem-admin', 'MEMBER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow demoting an admin when there are multiple admins', async () => {
      // Arrange
      const updated = { ...mockAdminMembership, role: 'MEMBER' as const };
      jest.spyOn(repository, 'findById').mockResolvedValue(mockAdminMembership);
      jest.spyOn(repository, 'countAdmins').mockResolvedValue(2);
      jest.spyOn(repository, 'update').mockResolvedValue(updated);

      // Act
      const result = await service.changeRole('org-1', 'mem-admin', 'MEMBER');

      // Assert
      expect(result.role).toBe('MEMBER');
    });
  });

  describe('removeMember', () => {
    it('should remove a member', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue({
        ...mockMembership,
        status: 'APPROVED' as const,
      });
      jest.spyOn(repository, 'softDelete').mockResolvedValue({
        ...mockMembership,
        deletedAt: new Date(),
      });

      // Act
      await service.removeMember('org-1', 'mem-1');

      // Assert
      expect(repository.softDelete).toHaveBeenCalledWith('mem-1');
    });

    it('should throw ForbiddenException when removing the last admin', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(mockAdminMembership);
      jest.spyOn(repository, 'countAdmins').mockResolvedValue(1);

      // Act & Assert
      await expect(service.removeMember('org-1', 'mem-admin')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when membership does not exist', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(service.removeMember('org-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
