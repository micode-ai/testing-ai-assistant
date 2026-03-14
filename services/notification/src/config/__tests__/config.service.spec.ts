import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '../config.service';
import { ConfigRepository } from '../config.repository';
import { NotificationChannel } from '../../../generated/prisma';

describe('ConfigService', () => {
  let service: ConfigService;
  let repository: jest.Mocked<ConfigRepository>;

  const mockConfig = {
    id: 'config-1',
    orgId: 'org-1',
    channel: NotificationChannel.EMAIL,
    event: 'run.finished',
    config: { emails: ['admin@example.com'] },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        {
          provide: ConfigRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByOrgId: jest.fn(),
            findByOrgAndEvent: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
    repository = module.get(ConfigRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a notification config', async () => {
      repository.create.mockResolvedValue(mockConfig);

      const result = await service.create({
        orgId: 'org-1',
        channel: NotificationChannel.EMAIL,
        event: 'run.finished',
        config: { emails: ['admin@example.com'] },
      });

      expect(result).toEqual(mockConfig);
      expect(repository.create).toHaveBeenCalledWith({
        orgId: 'org-1',
        channel: NotificationChannel.EMAIL,
        event: 'run.finished',
        config: { emails: ['admin@example.com'] },
      });
    });
  });

  describe('findByOrg', () => {
    it('should return configs for an organization', async () => {
      repository.findByOrgId.mockResolvedValue([mockConfig]);

      const result = await service.findByOrg('org-1');

      expect(result).toEqual([mockConfig]);
      expect(repository.findByOrgId).toHaveBeenCalledWith('org-1');
    });
  });

  describe('findById', () => {
    it('should return a config by ID', async () => {
      repository.findById.mockResolvedValue(mockConfig);

      const result = await service.findById('config-1');

      expect(result).toEqual(mockConfig);
    });

    it('should throw NotFoundException when config not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a config', async () => {
      const updatedConfig = { ...mockConfig, enabled: false };
      repository.findById.mockResolvedValue(mockConfig);
      repository.update.mockResolvedValue(updatedConfig);

      const result = await service.update('config-1', { enabled: false });

      expect(result).toEqual(updatedConfig);
      expect(repository.update).toHaveBeenCalledWith('config-1', { enabled: false });
    });

    it('should throw NotFoundException when updating non-existent config', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('nonexistent', { enabled: false })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a config', async () => {
      repository.findById.mockResolvedValue(mockConfig);
      repository.delete.mockResolvedValue(mockConfig);

      const result = await service.delete('config-1');

      expect(result).toEqual(mockConfig);
      expect(repository.delete).toHaveBeenCalledWith('config-1');
    });

    it('should throw NotFoundException when deleting non-existent config', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findConfigsForEvent', () => {
    it('should return enabled configs for an org and event', async () => {
      repository.findByOrgAndEvent.mockResolvedValue([mockConfig]);

      const result = await service.findConfigsForEvent('org-1', 'run.finished');

      expect(result).toEqual([mockConfig]);
      expect(repository.findByOrgAndEvent).toHaveBeenCalledWith('org-1', 'run.finished');
    });

    it('should return empty array when no configs match', async () => {
      repository.findByOrgAndEvent.mockResolvedValue([]);

      const result = await service.findConfigsForEvent('org-1', 'unknown.event');

      expect(result).toEqual([]);
    });
  });
});
