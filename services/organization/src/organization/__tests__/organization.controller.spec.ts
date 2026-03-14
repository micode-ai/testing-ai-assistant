import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { OrganizationController } from '../organization.controller';
import { OrganizationService } from '../organization.service';

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let service: OrganizationService;

  const mockUser = { sub: 'user-1', email: 'test@example.com' };

  const mockOrg = {
    id: 'org-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    plan: 'FREE' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [
        { provide: OrganizationService, useValue: createMock<OrganizationService>() },
      ],
    }).compile();

    controller = module.get<OrganizationController>(OrganizationController);
    service = module.get<OrganizationService>(OrganizationService);
  });

  describe('create', () => {
    it('should create an organization', async () => {
      // Arrange
      jest.spyOn(service, 'create').mockResolvedValue(mockOrg);

      // Act
      const result = await controller.create(mockUser, { name: 'Acme Corp' });

      // Assert
      expect(result.id).toBe('org-1');
      expect(result.name).toBe('Acme Corp');
      expect(result.memberCount).toBe(1);
      expect(service.create).toHaveBeenCalledWith('user-1', { name: 'Acme Corp' });
    });
  });

  describe('findAll', () => {
    it('should return organizations for the current user', async () => {
      // Arrange
      jest.spyOn(service, 'findByUser').mockResolvedValue([mockOrg]);

      // Act
      const result = await controller.findAll(mockUser);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('acme-corp');
    });
  });

  describe('findOne', () => {
    it('should return an organization with member count', async () => {
      // Arrange
      jest.spyOn(service, 'findById').mockResolvedValue(mockOrg);
      jest.spyOn(service, 'getMemberCount').mockResolvedValue(5);

      // Act
      const result = await controller.findOne('org-1');

      // Assert
      expect(result.id).toBe('org-1');
      expect(result.memberCount).toBe(5);
    });
  });

  describe('update', () => {
    it('should update an organization', async () => {
      // Arrange
      const updatedOrg = { ...mockOrg, name: 'Acme Inc' };
      jest.spyOn(service, 'update').mockResolvedValue(updatedOrg);

      // Act
      const result = await controller.update('org-1', { name: 'Acme Inc' });

      // Assert
      expect(result.name).toBe('Acme Inc');
      expect(service.update).toHaveBeenCalledWith('org-1', { name: 'Acme Inc' });
    });
  });

  describe('remove', () => {
    it('should delete an organization', async () => {
      // Arrange
      jest.spyOn(service, 'softDelete').mockResolvedValue(undefined);

      // Act
      await controller.remove('org-1');

      // Assert
      expect(service.softDelete).toHaveBeenCalledWith('org-1');
    });
  });
});
