import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHmac, timingSafeEqual } from 'crypto';
import { ProjectRepository } from '../project/project.repository';

export interface WebhookPayload {
  provider: string;
  event: string;
  action?: string;
  repository: {
    fullName: string;
    url: string;
  };
  sender?: {
    login: string;
  };
  ref?: string;
  raw: Record<string, unknown>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleWebhook(
    provider: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
  ): Promise<void> {
    const payload = this.parseWebhookPayload(provider, headers, body);

    const repoUrl = payload.repository.url;
    // Try to find a matching project by looking up the repo URL across all orgs
    const project = await this.findProjectByRepoUrl(repoUrl);

    if (!project) {
      this.logger.warn(`No project found for repository: ${repoUrl}`);
      throw new NotFoundException(`No project registered for repository: ${repoUrl}`);
    }

    this.validateSignature(provider, headers, body, project.webhookSecret);

    this.logger.log(
      `Webhook received: ${provider}/${payload.event} for project ${project.id}`,
    );

    this.eventEmitter.emit('webhook.received', {
      projectId: project.id,
      orgId: project.orgId,
      provider,
      event: payload.event,
      action: payload.action,
      payload,
      receivedAt: new Date(),
    });
  }

  parseWebhookPayload(
    provider: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
  ): WebhookPayload {
    switch (provider.toUpperCase()) {
      case 'GITHUB':
        return this.parseGitHubPayload(headers, body);
      case 'GITLAB':
        return this.parseGitLabPayload(headers, body);
      case 'BITBUCKET':
        return this.parseBitbucketPayload(headers, body);
      default:
        throw new BadRequestException(`Unsupported provider: ${provider}`);
    }
  }

  validateSignature(
    provider: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
    secret: string | null,
  ): void {
    if (!secret) {
      this.logger.warn('No webhook secret configured, skipping signature validation');
      return;
    }

    const bodyString = JSON.stringify(body);

    switch (provider.toUpperCase()) {
      case 'GITHUB': {
        const signature = headers['x-hub-signature-256'];
        if (!signature) {
          throw new BadRequestException('Missing GitHub signature header');
        }
        const expected = `sha256=${createHmac('sha256', secret).update(bodyString).digest('hex')}`;
        if (!this.safeCompare(signature, expected)) {
          throw new BadRequestException('Invalid GitHub webhook signature');
        }
        break;
      }
      case 'GITLAB': {
        const token = headers['x-gitlab-token'];
        if (!token) {
          throw new BadRequestException('Missing GitLab token header');
        }
        if (!this.safeCompare(token, secret)) {
          throw new BadRequestException('Invalid GitLab webhook token');
        }
        break;
      }
      case 'BITBUCKET': {
        // Bitbucket Cloud does not sign webhook payloads by default.
        // Validation is done via the webhook URL containing a secret path segment.
        this.logger.log('Bitbucket webhook signature validation skipped (not supported natively)');
        break;
      }
      default:
        throw new BadRequestException(`Unsupported provider for signature validation: ${provider}`);
    }
  }

  private parseGitHubPayload(
    headers: Record<string, string>,
    body: Record<string, unknown>,
  ): WebhookPayload {
    const event = headers['x-github-event'] || 'unknown';
    const repository = body.repository as Record<string, unknown> | undefined;

    if (!repository) {
      throw new BadRequestException('Invalid GitHub webhook payload: missing repository');
    }

    return {
      provider: 'GITHUB',
      event,
      action: body.action as string | undefined,
      repository: {
        fullName: (repository.full_name as string) || '',
        url: (repository.html_url as string) || '',
      },
      sender: body.sender
        ? { login: (body.sender as Record<string, unknown>).login as string }
        : undefined,
      ref: body.ref as string | undefined,
      raw: body,
    };
  }

  private parseGitLabPayload(
    headers: Record<string, string>,
    body: Record<string, unknown>,
  ): WebhookPayload {
    const event = (body.object_kind as string) || headers['x-gitlab-event'] || 'unknown';
    const project = body.project as Record<string, unknown> | undefined;

    if (!project) {
      throw new BadRequestException('Invalid GitLab webhook payload: missing project');
    }

    return {
      provider: 'GITLAB',
      event,
      action: body.action as string | undefined,
      repository: {
        fullName: (project.path_with_namespace as string) || '',
        url: (project.web_url as string) || '',
      },
      sender: body.user
        ? { login: (body.user as Record<string, unknown>).username as string }
        : undefined,
      ref: body.ref as string | undefined,
      raw: body,
    };
  }

  private parseBitbucketPayload(
    headers: Record<string, string>,
    body: Record<string, unknown>,
  ): WebhookPayload {
    const event = headers['x-event-key'] || 'unknown';
    const repository = body.repository as Record<string, unknown> | undefined;

    if (!repository) {
      throw new BadRequestException('Invalid Bitbucket webhook payload: missing repository');
    }

    const links = (repository.links as Record<string, unknown>) || {};
    const htmlLink = (links.html as Record<string, unknown>) || {};

    return {
      provider: 'BITBUCKET',
      event,
      action: undefined,
      repository: {
        fullName: (repository.full_name as string) || '',
        url: (htmlLink.href as string) || '',
      },
      sender: body.actor
        ? { login: (body.actor as Record<string, unknown>).display_name as string }
        : undefined,
      ref: undefined,
      raw: body,
    };
  }

  private async findProjectByRepoUrl(repoUrl: string) {
    // Search by normalized URL - strip trailing slashes and .git suffix
    const normalizedUrl = repoUrl.replace(/\/+$/, '').replace(/\.git$/, '');

    // Try exact match first, then try normalized
    const project = await this.projectRepository.findByRepoUrlGlobal(repoUrl);
    if (project) {
      return project;
    }

    // Try with normalized URL
    return this.projectRepository.findByRepoUrlGlobal(normalizedUrl);
  }

  private safeCompare(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a, 'utf-8');
      const bufB = Buffer.from(b, 'utf-8');
      if (bufA.length !== bufB.length) {
        return false;
      }
      return timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }
}
