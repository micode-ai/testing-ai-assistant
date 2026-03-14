import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebhookService } from '../webhook.service';
import { ProjectRepository } from '../../project/project.repository';

describe('WebhookService', () => {
  let service: WebhookService;
  let projectRepository: jest.Mocked<ProjectRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
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
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    projectRepository = module.get(ProjectRepository) as jest.Mocked<ProjectRepository>;
    eventEmitter = module.get(EventEmitter2) as jest.Mocked<EventEmitter2>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseWebhookPayload', () => {
    describe('GitHub', () => {
      it('should parse a GitHub push event', () => {
        const headers = {
          'x-github-event': 'push',
          'x-hub-signature-256': 'sha256=abc123',
        };
        const body = {
          ref: 'refs/heads/main',
          repository: {
            full_name: 'owner/repo',
            html_url: 'https://github.com/owner/repo',
          },
          sender: {
            login: 'testuser',
          },
        };

        const result = service.parseWebhookPayload('GITHUB', headers, body);

        expect(result.provider).toBe('GITHUB');
        expect(result.event).toBe('push');
        expect(result.repository.fullName).toBe('owner/repo');
        expect(result.repository.url).toBe('https://github.com/owner/repo');
        expect(result.sender?.login).toBe('testuser');
        expect(result.ref).toBe('refs/heads/main');
      });

      it('should parse a GitHub pull_request event', () => {
        const headers = { 'x-github-event': 'pull_request' };
        const body = {
          action: 'opened',
          repository: {
            full_name: 'owner/repo',
            html_url: 'https://github.com/owner/repo',
          },
          sender: { login: 'testuser' },
        };

        const result = service.parseWebhookPayload('GITHUB', headers, body);

        expect(result.event).toBe('pull_request');
        expect(result.action).toBe('opened');
      });

      it('should throw if repository is missing', () => {
        const headers = { 'x-github-event': 'push' };
        const body = {};

        expect(() => service.parseWebhookPayload('GITHUB', headers, body)).toThrow(
          BadRequestException,
        );
      });
    });

    describe('GitLab', () => {
      it('should parse a GitLab push event', () => {
        const headers = { 'x-gitlab-event': 'Push Hook' };
        const body = {
          object_kind: 'push',
          ref: 'refs/heads/main',
          project: {
            path_with_namespace: 'group/project',
            web_url: 'https://gitlab.com/group/project',
          },
          user: { username: 'testuser' },
        };

        const result = service.parseWebhookPayload('GITLAB', headers, body);

        expect(result.provider).toBe('GITLAB');
        expect(result.event).toBe('push');
        expect(result.repository.fullName).toBe('group/project');
        expect(result.repository.url).toBe('https://gitlab.com/group/project');
        expect(result.sender?.login).toBe('testuser');
      });

      it('should throw if project is missing from GitLab payload', () => {
        const headers = { 'x-gitlab-event': 'Push Hook' };
        const body = { object_kind: 'push' };

        expect(() => service.parseWebhookPayload('GITLAB', headers, body)).toThrow(
          BadRequestException,
        );
      });
    });

    describe('Bitbucket', () => {
      it('should parse a Bitbucket push event', () => {
        const headers = { 'x-event-key': 'repo:push' };
        const body = {
          repository: {
            full_name: 'owner/repo',
            links: {
              html: { href: 'https://bitbucket.org/owner/repo' },
            },
          },
          actor: { display_name: 'Test User' },
        };

        const result = service.parseWebhookPayload('BITBUCKET', headers, body);

        expect(result.provider).toBe('BITBUCKET');
        expect(result.event).toBe('repo:push');
        expect(result.repository.fullName).toBe('owner/repo');
        expect(result.repository.url).toBe('https://bitbucket.org/owner/repo');
        expect(result.sender?.login).toBe('Test User');
      });

      it('should throw if repository is missing from Bitbucket payload', () => {
        const headers = { 'x-event-key': 'repo:push' };
        const body = {};

        expect(() => service.parseWebhookPayload('BITBUCKET', headers, body)).toThrow(
          BadRequestException,
        );
      });
    });

    describe('unsupported provider', () => {
      it('should throw BadRequestException for unsupported provider', () => {
        expect(() => service.parseWebhookPayload('UNKNOWN', {}, {})).toThrow(
          BadRequestException,
        );
      });
    });
  });

  describe('validateSignature', () => {
    it('should skip validation if no secret is configured', () => {
      expect(() =>
        service.validateSignature('GITHUB', {}, {}, null),
      ).not.toThrow();
    });

    it('should throw if GitHub signature header is missing', () => {
      expect(() =>
        service.validateSignature('GITHUB', {}, {}, 'my-secret'),
      ).toThrow(BadRequestException);
    });

    it('should throw if GitHub signature is invalid', () => {
      const headers = { 'x-hub-signature-256': 'sha256=invalid' };

      expect(() =>
        service.validateSignature('GITHUB', headers, {}, 'my-secret'),
      ).toThrow(BadRequestException);
    });

    it('should accept valid GitHub signature', () => {
      const { createHmac } = require('crypto');
      const secret = 'my-secret';
      const body = { test: 'data' };
      const bodyString = JSON.stringify(body);
      const signature = `sha256=${createHmac('sha256', secret).update(bodyString).digest('hex')}`;
      const headers = { 'x-hub-signature-256': signature };

      expect(() =>
        service.validateSignature('GITHUB', headers, body, secret),
      ).not.toThrow();
    });

    it('should throw if GitLab token header is missing', () => {
      expect(() =>
        service.validateSignature('GITLAB', {}, {}, 'my-token'),
      ).toThrow(BadRequestException);
    });

    it('should throw if GitLab token is invalid', () => {
      const headers = { 'x-gitlab-token': 'wrong-token' };

      expect(() =>
        service.validateSignature('GITLAB', headers, {}, 'my-token'),
      ).toThrow(BadRequestException);
    });

    it('should accept valid GitLab token', () => {
      const headers = { 'x-gitlab-token': 'my-token' };

      expect(() =>
        service.validateSignature('GITLAB', headers, {}, 'my-token'),
      ).not.toThrow();
    });

    it('should not throw for Bitbucket (no native signature support)', () => {
      expect(() =>
        service.validateSignature('BITBUCKET', {}, {}, 'some-secret'),
      ).not.toThrow();
    });
  });

  describe('handleWebhook', () => {
    it('should process webhook and emit event when project is found', async () => {
      const mockProject = {
        id: 'project-1',
        orgId: 'org-1',
        name: 'Test',
        repoUrl: 'https://github.com/owner/repo',
        repoProvider: 'GITHUB' as const,
        repoOwner: 'owner',
        repoName: 'repo',
        defaultBranch: 'main',
        webhookId: 'wh_123',
        webhookSecret: null,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      projectRepository.findByRepoUrlGlobal.mockResolvedValue(mockProject);

      const headers = {
        'x-github-event': 'push',
      };
      const body = {
        ref: 'refs/heads/main',
        repository: {
          full_name: 'owner/repo',
          html_url: 'https://github.com/owner/repo',
        },
        sender: { login: 'testuser' },
      };

      await service.handleWebhook('GITHUB', headers, body);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'webhook.received',
        expect.objectContaining({
          projectId: 'project-1',
          orgId: 'org-1',
          provider: 'GITHUB',
          event: 'push',
        }),
      );
    });

    it('should throw NotFoundException when no project matches the repo URL', async () => {
      projectRepository.findByRepoUrlGlobal.mockResolvedValue(null);

      const headers = { 'x-github-event': 'push' };
      const body = {
        repository: {
          full_name: 'unknown/repo',
          html_url: 'https://github.com/unknown/repo',
        },
      };

      await expect(
        service.handleWebhook('GITHUB', headers, body),
      ).rejects.toThrow();
    });
  });
});
