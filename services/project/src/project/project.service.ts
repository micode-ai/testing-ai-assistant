import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RepoProvider } from '../../generated/prisma';
import { randomBytes } from 'crypto';
import { ProjectRepository } from './project.repository';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectEntity } from './entities/project.entity';
import { ProjectCreatedEvent } from './events/project-created.event';
import { ProjectUpdatedEvent } from './events/project-updated.event';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateProjectDto): Promise<ProjectEntity> {
    const existing = await this.projectRepository.findByRepoUrl(dto.orgId, dto.repoUrl);
    if (existing) {
      throw new ConflictException('A project with this repository URL already exists in the organization');
    }

    // Remove any soft-deleted projects with same repo URL to avoid unique constraint violation
    await this.projectRepository.hardDeleteSoftDeleted(dto.orgId, dto.repoUrl);

    const { owner, repo } = this.parseRepoUrl(dto.repoUrl, dto.repoProvider);

    const project = await this.projectRepository.create({
      orgId: dto.orgId,
      name: dto.name,
      repoUrl: dto.repoUrl,
      repoProvider: dto.repoProvider,
      repoOwner: owner,
      repoName: repo,
      defaultBranch: dto.defaultBranch || 'main',
      settings: (dto.settings || {}) as any,
    });

    this.logger.log(`Project created: ${project.id} (${project.name})`);

    this.eventEmitter.emit(
      ProjectCreatedEvent.EVENT_NAME,
      new ProjectCreatedEvent(
        project.id,
        project.orgId,
        project.name,
        project.repoUrl,
        project.repoProvider,
      ),
    );

    return new ProjectEntity(project);
  }

  async findByOrg(orgId: string): Promise<ProjectEntity[]> {
    const projects = await this.projectRepository.findByOrgId(orgId);
    return projects.map((p) => new ProjectEntity(p));
  }

  async findById(id: string): Promise<ProjectEntity> {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found`);
    }
    return new ProjectEntity(project);
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectEntity> {
    const existing = await this.findById(id);

    const project = await this.projectRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.defaultBranch !== undefined && { defaultBranch: dto.defaultBranch }),
      ...(dto.settings !== undefined && { settings: dto.settings as any }),
    } as any);

    this.logger.log(`Project updated: ${project.id}`);

    this.eventEmitter.emit(
      ProjectUpdatedEvent.EVENT_NAME,
      new ProjectUpdatedEvent(project.id, existing.orgId, dto as Record<string, unknown>),
    );

    return new ProjectEntity(project);
  }

  async delete(id: string): Promise<void> {
    const project = await this.findById(id);

    if (project.webhookId) {
      await this.disconnectWebhookInternal(project);
    }

    await this.projectRepository.softDelete(id);
    this.logger.log(`Project soft-deleted: ${id}`);
  }

  async connectWebhook(id: string): Promise<ProjectEntity> {
    const project = await this.findById(id);

    if (project.webhookId) {
      this.logger.warn(`Project ${id} already has a webhook connected`);
      return project;
    }

    const webhookSecret = randomBytes(32).toString('hex');
    const webhookId = await this.createProviderWebhook(project, webhookSecret);

    const updated = await this.projectRepository.update(id, {
      webhookId,
      webhookSecret,
    });

    this.logger.log(`Webhook connected for project ${id}: ${webhookId}`);
    return new ProjectEntity(updated);
  }

  async disconnectWebhook(id: string): Promise<ProjectEntity> {
    const project = await this.findById(id);

    if (!project.webhookId) {
      this.logger.warn(`Project ${id} has no webhook to disconnect`);
      return project;
    }

    await this.disconnectWebhookInternal(project);

    const updated = await this.projectRepository.update(id, {
      webhookId: null,
      webhookSecret: null,
    });

    this.logger.log(`Webhook disconnected for project ${id}`);
    return new ProjectEntity(updated);
  }

  private async disconnectWebhookInternal(project: ProjectEntity): Promise<void> {
    try {
      await this.deleteProviderWebhook(project);
    } catch (error) {
      this.logger.error(
        `Failed to delete webhook ${project.webhookId} from provider: ${(error as Error).message}`,
      );
    }
  }

  private async createProviderWebhook(
    project: ProjectEntity,
    secret: string,
  ): Promise<string> {
    const callbackUrl = this.getWebhookCallbackUrl(project.repoProvider);
    const token = this.getProviderToken(project.repoProvider);

    this.logger.log(
      `Creating webhook for ${project.repoOwner}/${project.repoName} on ${project.repoProvider}`,
    );

    // Integration point for @testing-ai/git-adapter
    // When the git-adapter package is available, replace this with:
    // const adapter = GitAdapterFactory.create(project.repoProvider, token);
    // return adapter.createWebhook(project.repoOwner, project.repoName, callbackUrl, secret);

    // For now, generate a placeholder webhook ID
    const webhookId = `wh_${randomBytes(16).toString('hex')}`;
    this.logger.log(`Webhook created with ID: ${webhookId} (callback: ${callbackUrl})`);
    return webhookId;
  }

  private async deleteProviderWebhook(project: ProjectEntity): Promise<void> {
    const token = this.getProviderToken(project.repoProvider);

    this.logger.log(
      `Deleting webhook ${project.webhookId} for ${project.repoOwner}/${project.repoName}`,
    );

    // Integration point for @testing-ai/git-adapter
    // When the git-adapter package is available, replace this with:
    // const adapter = GitAdapterFactory.create(project.repoProvider, token);
    // await adapter.deleteWebhook(project.repoOwner, project.repoName, project.webhookId);
  }

  private getProviderToken(provider: RepoProvider): string {
    const tokenMap: Record<RepoProvider, string> = {
      [RepoProvider.GITHUB]: 'GITHUB_TOKEN',
      [RepoProvider.GITLAB]: 'GITLAB_TOKEN',
      [RepoProvider.BITBUCKET]: 'BITBUCKET_TOKEN',
    };

    const token = this.configService.get<string>(tokenMap[provider]);
    if (!token) {
      this.logger.warn(`No token configured for provider: ${provider}`);
    }
    return token || '';
  }

  private getWebhookCallbackUrl(provider: RepoProvider): string {
    const baseUrl = this.configService.get<string>('DASHBOARD_URL', 'http://localhost:3003');
    return `${baseUrl}/webhooks/${provider.toLowerCase()}`;
  }

  private parseRepoUrl(
    repoUrl: string,
    provider: RepoProvider,
  ): { owner: string; repo: string } {
    try {
      const url = new URL(repoUrl);
      const pathParts = url.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');

      if (pathParts.length < 2) {
        throw new Error('Invalid repository URL: must contain owner and repo');
      }

      return {
        owner: pathParts[0],
        repo: pathParts[1],
      };
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Invalid repository URL: ${repoUrl}`);
      }
      throw error;
    }
  }
}
