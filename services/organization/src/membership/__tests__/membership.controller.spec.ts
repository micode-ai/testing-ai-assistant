import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { MembershipController } from '../membership.controller';
import { MembershipService } from '../membership.service';

describe('MembershipController', () => {
  let controller: MembershipController;
  let service: MembershipService;

  const mockUser = { sub: 'user-1', email: 'admin@example.com' };

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembershipController],
      providers: [
        { provide: MembershipService, useValue: createMock<MembershipService>() },
      ],
    }).compile();

    controller = module.get<MembershipController>(MembershipController);
    service = module.get<MembershipService>(MembershipService);
  });

  describe('invite', () => {
    it('should invite a member', async () => {
      // Arrange
      jest.spyOn(service, 'invite').mockResolvedValue(mockMembership);

      // Act
      const result = await controller.invite('org-1', mockUser, { userId: 'user-2' });

      // Assert
      expect(result.userId).toBe('user-2');
      expect(result.status).toBe('PENDING');
      expect(service.invite).toHaveBeenCalledWith('org-1', 'user-1', { userId: 'user-2' });
    });
  });

  describe('findAll', () => {
    it('should return all members of an organization', async () => {
      // Arrange
      jest.spyOn(service, 'listMembers').mockResolvedValue([mockMembership]);

      // Act
      const result = await controller.findAll('org-1');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].orgId).toBe('org-1');
    });
  });

  describe('approve', () => {
    it('should approve a membership', async () => {
      // Arrange
      const approved = { ...mockMembership, status: 'APPROVED' as const, resolvedAt: new Date() };
      jest.spyOn(service, 'approve').mockResolvedValue(approved);

      // Act
      const result = await controller.approve('org-1', 'mem-1', mockUser);

      // Assert
      expect(result.status).toBe('APPROVED');
      expect(service.approve).toHaveBeenCalledWith('org-1', 'mem-1', 'user-1');
    });
  });

  describe('reject', () => {
    it('should reject a membership', async () => {
      // Arrange
      const rejected = { ...mockMembership, status: 'REJECTED' as const, resolvedAt: new Date() };
      jest.spyOn(service, 'reject').mockResolvedValue(rejected);

      // Act
      const result = await controller.reject('org-1', 'mem-1', mockUser);

      // Assert
      expect(result.status).toBe('REJECTED');
      expect(service.reject).toHaveBeenCalledWith('org-1', 'mem-1', 'user-1');
    });
  });

  describe('changeRole', () => {
    it('should change member role', async () => {
      // Arrange
      const updated = { ...mockMembership, role: 'VIEWER' as const };
      jest.spyOn(service, 'changeRole').mockResolvedValue(updated);

      // Act
      const result = await controller.changeRole('org-1', 'mem-1', { role: 'VIEWER' });

      // Assert
      expect(result.role).toBe('VIEWER');
      expect(service.changeRole).toHaveBeenCalledWith('org-1', 'mem-1', 'VIEWER');
    });
  });

  describe('remove', () => {
    it('should remove a member', async () => {
      // Arrange
      jest.spyOn(service, 'removeMember').mockResolvedValue(undefined);

      // Act
      await controller.remove('org-1', 'mem-1');

      // Assert
      expect(service.removeMember).toHaveBeenCalledWith('org-1', 'mem-1');
    });
  });
});
