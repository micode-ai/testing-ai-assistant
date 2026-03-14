import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RepoProvider } from '../../../generated/prisma';
import { ProjectService } from '../project.service';
import { ProjectRepository } from '../project.repository';
import { ProjectCreatedEvent } from '../events/project-created.event';
import { ProjectUpdatedEvent } from '../events/project-updated.event';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

describe('ProjectService', () => {
  let service: ProjectService;
  let repository: jest.Mocked<ProjectRepository>;
  let configService: jest.Mocked<ConfigService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockProject = {
    id: 'project-1',
    orgId: 'org-1',
    name: 'Test Project',
    repoUrl: 'https://github.com/owner/repo',
    repoProvider: RepoProvider.GITHUB,
    repoOwner: 'owner',
    repoName: 'repo',
    defaultBranch: 'main',
    webhookId: null,
    webhookSecret: null,
    settings: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: ProjectRepository,
          useValue: {
            findById: jest.fn(),
            findByOrgId: jest.fn(),
            findByRepoUrl: jest.fn(),
            findByRepoUrlGlobal: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    repository = module.get(ProjectRepository) as jest.Mocked<ProjectRepository>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
    eventEmitter = module.get(EventEmitter2) as jest.Mocked<EventEmitter2>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateProjectDto = {
      orgId: 'org-1',
      name: 'Test Project',
      repoUrl: 'https://github.com/owner/repo',
      repoProvider: RepoProvider.GITHUB,
    };

    it('should create a project and emit event', async () => {
      repository.findByRepoUrl.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockProject);

      const result = await service.create(createDto);

      expect(result.id).toBe('project-1');
      expect(result.name).toBe('Test Project');
      expect(result.repoOwner).toBe('owner');
      expect(result.repoName).toBe('repo');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          name: 'Test Project',
          repoUrl: 'https://github.com/owner/repo',
          repoProvider: RepoProvider.GITHUB,
          repoOwner: 'owner',
          repoName: 'repo',
          defaultBranch: 'main',
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        ProjectCreatedEvent.EVENT_NAME,
        expect.any(ProjectCreatedEvent),
      );
    });

    it('should throw ConflictException if repo URL already exists for org', async () => {
      repository.findByRepoUrl.mockResolvedValue(mockProject);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should use custom default branch if provided', async () => {
      repository.findByRepoUrl.mockResolvedValue(null);
      repository.create.mockResolvedValue({ ...mockProject, defaultBranch: 'develop' });

      await service.create({ ...createDto, defaultBranch: 'develop' });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ defaultBranch: 'develop' }),
      );
    });

    it('should parse GitLab repo URL correctly', async () => {
      const gitlabDto: CreateProjectDto = {
        orgId: 'org-1',
        name: 'GitLab Project',
        repoUrl: 'https://gitlab.com/group/project',
        repoProvider: RepoProvider.GITLAB,
      };

      repository.findByRepoUrl.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        ...mockProject,
        repoUrl: gitlabDto.repoUrl,
        repoProvider: RepoProvider.GITLAB,
        repoOwner: 'group',
        repoName: 'project',
      });

      await service.create(gitlabDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          repoOwner: 'group',
          repoName: 'project',
        }),
      );
    });
  });

  describe('findByOrg', () => {
    it('should return projects for an organization', async () => {
      repository.findByOrgId.mockResolvedValue([mockProject]);

      const result = await service.findByOrg('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].orgId).toBe('org-1');
      expect(repository.findByOrgId).toHaveBeenCalledWith('org-1');
    });

    it('should return empty array if no projects found', async () => {
      repository.findByOrgId.mockResolvedValue([]);

      const result = await service.findByOrg('org-2');

      expect(result).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return project by ID', async () => {
      repository.findById.mockResolvedValue(mockProject);

      const result = await service.findById('project-1');

      expect(result.id).toBe('project-1');
    });

    it('should throw NotFoundException if project does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateProjectDto = { name: 'Updated Name' };

    it('should update project and emit event', async () => {
      repository.findById.mockResolvedValue(mockProject);
      repository.update.mockResolvedValue({ ...mockProject, name: 'Updated Name' });

      const result = await service.update('project-1', updateDto);

      expect(result.name).toBe('Updated Name');
      expect(repository.update).toHaveBeenCalledWith('project-1', { name: 'Updated Name' });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        ProjectUpdatedEvent.EVENT_NAME,
        expect.any(ProjectUpdatedEvent),
      );
    });

    it('should throw NotFoundException if project does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should soft delete a project', async () => {
      repository.findById.mockResolvedValue(mockProject);
      repository.softDelete.mockResolvedValue({ ...mockProject, deletedAt: new Date() });

      await service.delete('project-1');

      expect(repository.softDelete).toHaveBeenCalledWith('project-1');
    });

    it('should disconnect webhook before deleting if one exists', async () => {
      const projectWithWebhook = {
        ...mockProject,
        webhookId: 'wh_123',
        webhookSecret: 'secret',
      };
      repository.findById.mockResolvedValue(projectWithWebhook);
      repository.update.mockResolvedValue({ ...projectWithWebhook, webhookId: null, webhookSecret: null });
      repository.softDelete.mockResolvedValue({ ...projectWithWebhook, deletedAt: new Date() });

      await service.delete('project-1');

      expect(repository.softDelete).toHaveBeenCalledWith('project-1');
    });

    it('should throw NotFoundException if project does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('connectWebhook', () => {
    it('should connect a webhook and update project', async () => {
      repository.findById.mockResolvedValue(mockProject);
      repository.update.mockResolvedValue({
        ...mockProject,
        webhookId: 'wh_abc123',
        webhookSecret: 'secret',
      });
      configService.get.mockReturnValue('http://localhost:3003');

      const result = await service.connectWebhook('project-1');

      expect(result.webhookId).toBeDefined();
      expect(repository.update).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          webhookId: expect.any(String),
          webhookSecret: expect.any(String),
        }),
      );
    });

    it('should return existing project if webhook already connected', async () => {
      const projectWithWebhook = { ...mockProject, webhookId: 'wh_existing' };
      repository.findById.mockResolvedValue(projectWithWebhook);

      const result = await service.connectWebhook('project-1');

      expect(result.webhookId).toBe('wh_existing');
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('disconnectWebhook', () => {
    it('should disconnect webhook and clear fields', async () => {
      const projectWithWebhook = {
        ...mockProject,
        webhookId: 'wh_123',
        webhookSecret: 'secret',
      };
      repository.findById.mockResolvedValue(projectWithWebhook);
      repository.update.mockResolvedValue({
        ...mockProject,
        webhookId: null,
        webhookSecret: null,
      });

      const result = await service.disconnectWebhook('project-1');

      expect(result.webhookId).toBeNull();
      expect(repository.update).toHaveBeenCalledWith('project-1', {
        webhookId: null,
        webhookSecret: null,
      });
    });

    it('should return project unchanged if no webhook connected', async () => {
      repository.findById.mockResolvedValue(mockProject);

      const result = await service.disconnectWebhook('project-1');

      expect(result.webhookId).toBeNull();
      expect(repository.update).not.toHaveBeenCalled();
    });
  });
});
