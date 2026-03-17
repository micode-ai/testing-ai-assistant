import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GitAdapter } from './git-adapter.interface';
import { GitHubAdapter } from './github.adapter';
import { GitLabAdapter } from './gitlab.adapter';
import { BitbucketAdapter } from './bitbucket.adapter';

export type RepoProvider = 'GITHUB' | 'GITLAB' | 'BITBUCKET';

@Injectable()
export class GitAdapterFactory {
  private readonly logger = new Logger(GitAdapterFactory.name);
  private readonly orgServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.orgServiceUrl = this.configService.get<string>(
      'ORGANIZATION_SERVICE_URL',
      'http://localhost:3002',
    );
  }

  /**
   * Create a git adapter using the organization's configured provider token.
   */
  async createForOrg(provider: RepoProvider, orgId: string): Promise<GitAdapter> {
    const token = await this.fetchOrgToken(orgId, provider);
    return this.createWithToken(provider, token);
  }

  /**
   * Create a git adapter with an explicit token.
   */
  createWithToken(provider: RepoProvider, token: string): GitAdapter {
    switch (provider) {
      case 'GITHUB':
        return new GitHubAdapter(token);
      case 'GITLAB': {
        const baseUrl = this.configService.get<string>('GITLAB_URL', 'https://gitlab.com');
        return new GitLabAdapter(token, baseUrl);
      }
      case 'BITBUCKET':
        return new BitbucketAdapter(token);
      default:
        throw new BadRequestException(`Unsupported repo provider: ${provider}`);
    }
  }

  private async fetchOrgToken(orgId: string, provider: RepoProvider): Promise<string> {
    const url = `${this.orgServiceUrl}/api/v1/provider-tokens?orgId=${orgId}&provider=${provider}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          throw new BadRequestException(
            `No ${provider} token configured for this organization. Ask an admin to add it in Organization Settings → Integrations.`,
          );
        }
        throw new BadRequestException(`Failed to retrieve ${provider} token`);
      }

      const data = (await response.json()) as { token: string };
      return data.token;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to fetch org token: ${(error as Error).message}`);
      throw new BadRequestException(
        `Cannot connect to Organization Service to retrieve ${provider} token`,
      );
    }
  }
}
