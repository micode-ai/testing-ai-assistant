import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GitAdapterFactory, RepoProvider } from '../git-adapter';
import type { GitAdapter } from '../git-adapter';
import type { TestResultEntry } from '../agents/types';

interface ProjectInfo {
  id: string;
  orgId: string;
  repoUrl: string;
  repoProvider: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
}

interface PipelineRunResult {
  runId: string;
  status: string;
  branch: string;
  commitSha: string;
  finishedAt: string;
  results: Array<{
    checkType: string;
    status: string;
    summary: string;
    details: Record<string, unknown>;
    durationMs: number;
  }>;
}

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2',
  '.ttf', '.eot', '.mp3', '.mp4', '.webm', '.zip', '.tar', '.gz',
  '.pdf', '.lock',
]);

/** Max characters per file content */
const MAX_FILE_CHARS = 3000;
/** Max files to fetch full content for */
const MAX_FILES = 10;
/** Max total characters for codeDiff */
const MAX_DIFF_CHARS = 15000;
/** Max total characters for all file contents combined */
const MAX_CONTEXT_CHARS = 30000;

@Injectable()
export class BugDetectContextService {
  private readonly logger = new Logger(BugDetectContextService.name);
  private readonly projectServiceUrl: string;
  private readonly pipelineServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly gitAdapterFactory: GitAdapterFactory,
  ) {
    this.projectServiceUrl = this.configService.get<string>(
      'PROJECT_SERVICE_URL',
      'http://localhost:3003',
    );
    this.pipelineServiceUrl = this.configService.get<string>(
      'PIPELINE_SERVICE_URL',
      'http://localhost:3004',
    );
  }

  async fetchBugDetectContext(projectId: string): Promise<{
    codeDiff: string;
    testResults: TestResultEntry[];
    existingCodeContext: Record<string, string>;
  }> {
    const project = await this.fetchProjectInfo(projectId);
    const adapter = await this.createAdapter(project);

    const [diffResult, testResults] = await Promise.all([
      this.fetchDiffAndContext(adapter, project),
      this.fetchTestResults(projectId),
    ]);

    return {
      codeDiff: diffResult.codeDiff,
      existingCodeContext: diffResult.existingCodeContext,
      testResults,
    };
  }

  private async fetchDiffAndContext(
    adapter: GitAdapter,
    project: ProjectInfo,
  ): Promise<{ codeDiff: string; existingCodeContext: Record<string, string> }> {
    const { repoOwner, repoName, defaultBranch } = project;

    let diffEntries;
    try {
      diffEntries = await adapter.getDiff(
        repoOwner,
        repoName,
        `${defaultBranch}~2`,
        defaultBranch,
      );
    } catch (error) {
      this.logger.warn(`Failed to fetch diff: ${(error as Error).message}`);
      return { codeDiff: '', existingCodeContext: {} };
    }

    // Build diff string with size limit
    let codeDiff = '';
    for (const entry of diffEntries) {
      if (!entry.patch) continue;
      const chunk = `--- ${entry.filename}\n${entry.patch}\n\n`;
      if (codeDiff.length + chunk.length > MAX_DIFF_CHARS) break;
      codeDiff += chunk;
    }

    const filesToFetch = diffEntries
      .filter((e) => e.status !== 'removed')
      .map((e) => e.filename)
      .filter((f) => !BINARY_EXTENSIONS.has(f.substring(f.lastIndexOf('.')).toLowerCase()))
      .slice(0, MAX_FILES);

    let existingCodeContext: Record<string, string> = {};
    if (filesToFetch.length > 0) {
      try {
        const files = await adapter.getMultipleFiles(
          repoOwner,
          repoName,
          defaultBranch,
          filesToFetch,
        );
        let totalChars = 0;
        for (const file of files) {
          const content = file.content.slice(0, MAX_FILE_CHARS);
          if (totalChars + content.length > MAX_CONTEXT_CHARS) break;
          existingCodeContext[file.path] = content;
          totalChars += content.length;
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch file contents: ${(error as Error).message}`);
      }
    }

    this.logger.debug(
      `Bug detect context: diff=${codeDiff.length} chars, files=${Object.keys(existingCodeContext).length}`,
    );

    return { codeDiff, existingCodeContext };
  }

  private async fetchTestResults(projectId: string): Promise<TestResultEntry[]> {
    try {
      const response = await fetch(
        `${this.pipelineServiceUrl}/api/v1/runs/by-project/${projectId}/latest`,
      );

      if (!response.ok) {
        this.logger.warn(`Pipeline service returned ${response.status} for project ${projectId}`);
        return [];
      }

      const data = await response.json() as PipelineRunResult | null;
      if (!data || !data.results) {
        return [];
      }

      return data.results.map((r) => ({
        testName: r.checkType,
        status: this.mapStatus(r.status),
        duration: r.durationMs,
        errorMessage: r.status === 'FAILED' ? r.summary : undefined,
        errorStack: r.status === 'FAILED' && r.details?.stack
          ? String(r.details.stack)
          : undefined,
      }));
    } catch (error) {
      this.logger.warn(`Failed to fetch test results: ${(error as Error).message}`);
      return [];
    }
  }

  private mapStatus(status: string): 'passed' | 'failed' | 'skipped' {
    switch (status.toUpperCase()) {
      case 'PASSED': return 'passed';
      case 'FAILED': return 'failed';
      default: return 'skipped';
    }
  }

  private async createAdapter(project: ProjectInfo): Promise<GitAdapter> {
    return this.gitAdapterFactory.createForOrg(
      project.repoProvider as RepoProvider,
      project.orgId,
    );
  }

  private async fetchProjectInfo(projectId: string): Promise<ProjectInfo> {
    const response = await fetch(
      `${this.projectServiceUrl}/api/v1/projects/${projectId}`,
    );
    if (!response.ok) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return response.json() as Promise<ProjectInfo>;
  }
}
