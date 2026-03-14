import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrganizationService } from '../organization.service';
import { OrganizationRepository } from '../organization.repository';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('@testing-ai/shared-utils', () => ({
  generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
}));

describe('OrganizationService', () => {
  let service: OrganizationService;
  let repository: OrganizationRepository;
  let eventEmitter: EventEmitter2;
  let prisma: PrismaService;

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
      providers: [
        OrganizationService,
        { provide: OrganizationRepository, useValue: createMock<OrganizationRepository>() },
        { provide: EventEmitter2, useValue: createMock<EventEmitter2>() },
        { provide: PrismaService, useValue: createMock<PrismaService>() },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    repository = module.get<OrganizationRepository>(OrganizationRepository);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create an organization and add creator as admin', async () => {
      // Arrange
      const userId = 'user-1';
      const dto = { name: 'Acme Corp' };
      jest.spyOn(repository, 'findBySlug').mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: Function) => {
        return fn({
          organization: { create: jest.fn().mockResolvedValue(mockOrg) },
          orgMembership: { create: jest.fn().mockResolvedValue({}) },
        });
      });

      // Act
      const result = await service.create(userId, dto);

      // Assert
      expect(result).toEqual(mockOrg);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'organization.created',
        expect.objectContaining({ aggregateId: mockOrg.id }),
      );
    });

    it('should throw ConflictException when slug already exists', async () => {
      // Arrange
      const userId = 'user-1';
      const dto = { name: 'Acme Corp' };
      jest.spyOn(repository, 'findBySlug').mockResolvedValue(mockOrg);

      // Act & Assert
      await expect(service.create(userId, dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findByUser', () => {
    it('should return organizations for a user', async () => {
      // Arrange
      jest.spyOn(repository, 'findByUserId').mockResolvedValue([mockOrg]);

      // Act
      const result = await service.findByUser('user-1');

      // Assert
      expect(result).toEqual([mockOrg]);
      expect(repository.findByUserId).toHaveBeenCalledWith('user-1');
    });
  });

  describe('findById', () => {
    it('should return an organization by id', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(mockOrg);

      // Act
      const result = await service.findById('org-1');

      // Assert
      expect(result).toEqual(mockOrg);
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an organization', async () => {
      // Arrange
      const updatedOrg = { ...mockOrg, name: 'Acme Inc' };
      jest.spyOn(repository, 'findById').mockResolvedValue(mockOrg);
      jest.spyOn(repository, 'findBySlug').mockResolvedValue(null);
      jest.spyOn(repository, 'update').mockResolvedValue(updatedOrg);

      // Act
      const result = await service.update('org-1', { name: 'Acme Inc' });

      // Assert
      expect(result.name).toBe('Acme Inc');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'organization.updated',
        expect.objectContaining({ aggregateId: 'org-1' }),
      );
    });

    it('should throw ConflictException when new slug conflicts with another org', async () => {
      // Arrange
      const otherOrg = { ...mockOrg, id: 'org-2' };
      jest.spyOn(repository, 'findById').mockResolvedValue(mockOrg);
      jest.spyOn(repository, 'findBySlug').mockResolvedValue(otherOrg);

      // Act & Assert
      await expect(service.update('org-1', { name: 'Acme Corp' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('softDelete', () => {
    it('should soft delete an organization', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(mockOrg);
      jest.spyOn(repository, 'softDelete').mockResolvedValue({
        ...mockOrg,
        deletedAt: new Date(),
      });

      // Act
      await service.softDelete('org-1');

      // Assert
      expect(repository.softDelete).toHaveBeenCalledWith('org-1');
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(service.softDelete('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
