import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ProjectInfo {
  id: string;
  repoUrl: string;
  repoProvider: string;
  defaultBranch: string;
  name: string;
}

/**
 * HTTP client for the Project Service.
 * Used to fetch project metadata (repoUrl, etc.) needed for pipeline execution.
 */
@Injectable()
export class ProjectClient {
  private readonly logger = new Logger(ProjectClient.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get('PROJECT_SERVICE_URL', 'http://localhost:3003');
  }

  async getProject(projectId: string): Promise<ProjectInfo> {
    const url = `${this.baseUrl}/api/v1/projects/${projectId}`;
    this.logger.debug(`Fetching project ${projectId} from ${url}`);

    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch project ${projectId}: HTTP ${response.status}`);
    }

    const data = await response.json() as ProjectInfo;
    this.logger.debug(`Fetched project: ${data.name} (${data.repoUrl})`);
    return data;
  }
}
