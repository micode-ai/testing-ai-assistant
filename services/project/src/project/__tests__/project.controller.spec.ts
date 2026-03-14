import { Test, TestingModule } from '@nestjs/testing';
import { RepoProvider } from '../../../generated/prisma';
import { ProjectController } from '../project.controller';
import { ProjectService } from '../project.service';
import { ProjectEntity } from '../entities/project.entity';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

describe('ProjectController', () => {
  let controller: ProjectController;
  let service: jest.Mocked<ProjectService>;

  const mockProjectEntity = new ProjectEntity({
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
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        {
          provide: ProjectService,
          useValue: {
            create: jest.fn(),
            findByOrg: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            connectWebhook: jest.fn(),
            disconnectWebhook: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProjectController>(ProjectController);
    service = module.get(ProjectService) as jest.Mocked<ProjectService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /projects', () => {
    it('should create a project', async () => {
      const dto: CreateProjectDto = {
        orgId: 'org-1',
        name: 'Test Project',
        repoUrl: 'https://github.com/owner/repo',
        repoProvider: RepoProvider.GITHUB,
      };
      service.create.mockResolvedValue(mockProjectEntity);

      const result = await controller.create(dto, 'user-1');

      expect(result.id).toBe('project-1');
      expect(result.name).toBe('Test Project');
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('GET /projects', () => {
    it('should return projects for an organization', async () => {
      service.findByOrg.mockResolvedValue([mockProjectEntity]);

      const result = await controller.findByOrg('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].orgId).toBe('org-1');
      expect(service.findByOrg).toHaveBeenCalledWith('org-1');
    });

    it('should return empty array when no projects exist', async () => {
      service.findByOrg.mockResolvedValue([]);

      const result = await controller.findByOrg('org-2');

      expect(result).toHaveLength(0);
    });
  });

  describe('GET /projects/:id', () => {
    it('should return a project by ID', async () => {
      service.findById.mockResolvedValue(mockProjectEntity);

      const result = await controller.findById('project-1');

      expect(result.id).toBe('project-1');
      expect(service.findById).toHaveBeenCalledWith('project-1');
    });
  });

  describe('PATCH /projects/:id', () => {
    it('should update a project', async () => {
      const dto: UpdateProjectDto = { name: 'Updated Name' };
      const updatedEntity = new ProjectEntity({ ...mockProjectEntity, name: 'Updated Name' });
      service.update.mockResolvedValue(updatedEntity);

      const result = await controller.update('project-1', dto);

      expect(result.name).toBe('Updated Name');
      expect(service.update).toHaveBeenCalledWith('project-1', dto);
    });
  });

  describe('DELETE /projects/:id', () => {
    it('should soft delete a project', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete('project-1');

      expect(service.delete).toHaveBeenCalledWith('project-1');
    });
  });

  describe('POST /projects/:id/webhook/connect', () => {
    it('should connect a webhook', async () => {
      const entityWithWebhook = new ProjectEntity({
        ...mockProjectEntity,
        webhookId: 'wh_123',
      });
      service.connectWebhook.mockResolvedValue(entityWithWebhook);

      const result = await controller.connectWebhook('project-1');

      expect(result.webhookId).toBe('wh_123');
      expect(service.connectWebhook).toHaveBeenCalledWith('project-1');
    });
  });

  describe('DELETE /projects/:id/webhook/disconnect', () => {
    it('should disconnect a webhook', async () => {
      const entityWithoutWebhook = new ProjectEntity({
        ...mockProjectEntity,
        webhookId: null,
      });
      service.disconnectWebhook.mockResolvedValue(entityWithoutWebhook);

      const result = await controller.disconnectWebhook('project-1');

      expect(result.webhookId).toBeNull();
      expect(service.disconnectWebhook).toHaveBeenCalledWith('project-1');
    });
  });
});
