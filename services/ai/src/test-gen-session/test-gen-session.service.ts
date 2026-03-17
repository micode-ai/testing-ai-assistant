import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TestGenSessionRepository } from './test-gen-session.repository';
import { ProjectProfileRepository } from './project-profile.repository';
import { ProjectAnalyzerService } from '../agents/project-analyzer/project-analyzer.service';
import { TestProposerService } from '../agents/test-proposer/test-proposer.service';
import { TestGeneratorService } from '../agents/test-generator/test-generator.service';
import { GitAdapterFactory, RepoProvider } from '../git-adapter';
import type { GitAdapter } from '../git-adapter';
import {
  ProjectProfile,
  TestProposal,
  TestProposalItem,
} from '../agents/types';

interface ProjectInfo {
  id: string;
  orgId: string;
  repoUrl: string;
  repoProvider: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  name: string;
}

@Injectable()
export class TestGenSessionService {
  private readonly logger = new Logger(TestGenSessionService.name);
  private readonly projectServiceUrl: string;

  constructor(
    private readonly sessionRepo: TestGenSessionRepository,
    private readonly profileRepo: ProjectProfileRepository,
    private readonly projectAnalyzerService: ProjectAnalyzerService,
    private readonly testProposerService: TestProposerService,
    private readonly testGeneratorService: TestGeneratorService,
    private readonly gitAdapterFactory: GitAdapterFactory,
    private readonly configService: ConfigService,
  ) {
    this.projectServiceUrl = this.configService.get<string>(
      'PROJECT_SERVICE_URL',
      'http://localhost:3003',
    );
  }

  // --- Step 1: Create session and analyze project ---

  async startSession(projectId: string, locale?: string) {
    const session = await this.sessionRepo.create({
      projectId,
      status: 'ANALYZING',
    });

    this.analyzeProject(session.id, projectId).catch((err) => {
      this.logger.error(`Analysis failed for session ${session.id}: ${err.message}`);
    });

    return session;
  }

  async analyzeProject(sessionId: string, projectId: string) {
    try {
      const project = await this.fetchProjectInfo(projectId);
      const adapter = await this.createAdapter(project);

      const fileTree = await adapter.getFileTree(
        project.repoOwner,
        project.repoName,
        project.defaultBranch,
      );
      const filePaths = fileTree
        .filter((e) => e.type === 'file')
        .map((e) => e.path);

      const configPatterns = [
        'package.json',
        'tsconfig.json',
        'jest.config.ts',
        'jest.config.js',
        'vitest.config.ts',
        'vitest.config.js',
        '.eslintrc.js',
        '.eslintrc.json',
        'pyproject.toml',
        'setup.py',
        'setup.cfg',
        'pom.xml',
        'build.gradle',
        'Cargo.toml',
        'go.mod',
        'pnpm-workspace.yaml',
        'turbo.json',
      ];
      const configFilePaths = filePaths.filter((f) =>
        configPatterns.some((p) => f === p || f.endsWith(`/${p}`)),
      );

      const testFilePatterns = [
        /\.spec\.\w+$/,
        /\.test\.\w+$/,
        /test_\w+\.\w+$/,
        /_test\.\w+$/,
        /Test\.\w+$/,
        /__tests__\//,
      ];
      const existingTestFiles = filePaths.filter((f) =>
        testFilePatterns.some((p) => p.test(f)),
      );

      const configContents = await adapter.getMultipleFiles(
        project.repoOwner,
        project.repoName,
        project.defaultBranch,
        configFilePaths.slice(0, 15),
      );

      const configFiles: Record<string, string> = {};
      for (const file of configContents) {
        configFiles[file.path] = file.content;
      }

      const agentOutput = await this.projectAnalyzerService.analyze({
        projectId,
        context: {
          fileTree: filePaths,
          configFiles,
          existingTestFiles,
          repoProvider: project.repoProvider,
        },
      });

      const profile: ProjectProfile = JSON.parse(agentOutput.result);

      const savedProfile = await this.profileRepo.upsert(projectId, {
        language: profile.language,
        testFramework: profile.testFramework,
        packageManager: profile.packageManager,
        structure: profile.structure as any,
        testPatterns: profile.testPatterns as any,
        dependencies: profile.dependencies as any,
      });

      await this.sessionRepo.update(sessionId, {
        status: 'PROPOSING',
        profileId: savedProfile.id,
        totalTokensUsed: agentOutput.tokensUsed,
      });

      this.logger.log(`Project analysis completed for session ${sessionId}`);
      return savedProfile;
    } catch (error) {
      await this.sessionRepo.update(sessionId, {
        status: 'FAILED',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // --- Step 2: Generate test proposal ---

  async generateProposal(sessionId: string, focusArea?: string, locale?: string) {
    const session = await this.getSession(sessionId);
    if (!session.profileId) {
      throw new BadRequestException('Project must be analyzed first');
    }

    await this.sessionRepo.update(sessionId, { status: 'PROPOSING' });

    try {
      const profileRecord = await this.profileRepo.findById(session.profileId);
      if (!profileRecord) throw new NotFoundException('Project profile not found');

      const profile: ProjectProfile = {
        language: profileRecord.language,
        testFramework: profileRecord.testFramework,
        packageManager: profileRecord.packageManager,
        structure: profileRecord.structure as any,
        testPatterns: profileRecord.testPatterns as any,
        dependencies: profileRecord.dependencies as any,
      };

      const project = await this.fetchProjectInfo(session.projectId);
      const adapter = await this.createAdapter(project);

      const sourceFiles = (profile.structure as any).sourceDirectories || ['src'];
      const testFiles = new Set((profile.testPatterns as any)?.existingTests || []);

      const fileTree = await adapter.getFileTree(
        project.repoOwner,
        project.repoName,
        project.defaultBranch,
      );

      const sourceFilePaths = fileTree
        .filter((e) => e.type === 'file')
        .filter((f) => sourceFiles.some((dir: string) => f.path.startsWith(dir)))
        .filter((f) => !testFiles.has(f.path))
        .filter((f) => /\.(ts|js|tsx|jsx|py|java|go|rs)$/.test(f.path))
        .filter((f) => !f.path.includes('.d.ts'))
        .filter((f) => !f.path.includes('index.'))
        .map((f) => f.path)
        .slice(0, 30);

      const fileContents = await adapter.getMultipleFiles(
        project.repoOwner,
        project.repoName,
        project.defaultBranch,
        sourceFilePaths,
      );

      const fileContentsMap: Record<string, string> = {};
      for (const file of fileContents) {
        fileContentsMap[file.path] = file.content;
      }

      const agentOutput = await this.testProposerService.propose({
        projectId: session.projectId,
        context: {
          profile,
          fileContents: fileContentsMap,
          focusArea,
          locale,
        },
      });

      const proposal: TestProposal = JSON.parse(agentOutput.result);

      await this.sessionRepo.update(sessionId, {
        status: 'AWAITING_APPROVAL',
        proposal: proposal as any,
      });
      await this.sessionRepo.addTokens(sessionId, agentOutput.tokensUsed);

      return proposal;
    } catch (error) {
      await this.sessionRepo.update(sessionId, {
        status: 'FAILED',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // --- Step 3: Approve proposal ---

  async approveProposal(sessionId: string, approvedItemIds: string[]) {
    const session = await this.getSession(sessionId);
    if (session.status !== 'AWAITING_APPROVAL') {
      throw new BadRequestException(`Session is in ${session.status} status, expected AWAITING_APPROVAL`);
    }

    const proposal = session.proposal as unknown as TestProposal;
    if (!proposal?.items) {
      throw new BadRequestException('No proposal found');
    }

    const approvedItems = proposal.items.filter((item) =>
      approvedItemIds.includes(item.id),
    );

    if (approvedItems.length === 0) {
      throw new BadRequestException('No items selected for approval');
    }

    await this.sessionRepo.update(sessionId, {
      approvedItems: approvedItems as any,
      status: 'GENERATING',
    });

    return { approvedCount: approvedItems.length };
  }

  // --- Step 4: Generate approved tests ---

  /**
   * Start test generation in background and return immediately.
   */
  async startTestGeneration(sessionId: string) {
    const session = await this.getSession(sessionId);
    if (session.status !== 'GENERATING') {
      throw new BadRequestException(`Session is in ${session.status} status, expected GENERATING`);
    }

    // Fire async, don't await
    this.generateApprovedTests(sessionId).catch((err) => {
      this.logger.error(`Test generation failed for session ${sessionId}: ${err.message}`);
    });

    return { status: 'GENERATING', sessionId };
  }

  async generateApprovedTests(sessionId: string) {
    const session = await this.getSession(sessionId);
    if (session.status !== 'GENERATING') {
      throw new BadRequestException(`Session is in ${session.status} status, expected GENERATING`);
    }

    const approvedItems = session.approvedItems as unknown as TestProposalItem[];
    if (!approvedItems?.length) {
      throw new BadRequestException('No approved items found');
    }

    try {
      const profileRecord = await this.profileRepo.findById(session.profileId!);
      if (!profileRecord) throw new NotFoundException('Project profile not found');

      const profile: ProjectProfile = {
        language: profileRecord.language,
        testFramework: profileRecord.testFramework,
        packageManager: profileRecord.packageManager,
        structure: profileRecord.structure as any,
        testPatterns: profileRecord.testPatterns as any,
        dependencies: profileRecord.dependencies as any,
      };

      const project = await this.fetchProjectInfo(session.projectId);
      const adapter = await this.createAdapter(project);

      const targetFiles = [...new Set(approvedItems.map((i) => i.targetFile))];
      const fileContents = await adapter.getMultipleFiles(
        project.repoOwner,
        project.repoName,
        project.defaultBranch,
        targetFiles,
      );

      const fileContentsMap: Record<string, string> = {};
      for (const file of fileContents) {
        fileContentsMap[file.path] = file.content;
      }

      const generatedTests: Array<{ path: string; content: string }> = [];
      let totalTokens = 0;
      const totalItems = approvedItems.length;

      for (let i = 0; i < approvedItems.length; i++) {
        const item = approvedItems[i];

        // Update progress
        await this.sessionRepo.update(sessionId, {
          metadata: {
            currentTest: i + 1,
            totalTests: totalItems,
            currentFile: item.testFilePath,
          } as any,
        });

        this.logger.log(`Generating test ${i + 1}/${totalItems}: ${item.testFilePath}`);

        const agentOutput = await this.testGeneratorService.generateFast({
          projectId: session.projectId,
          context: {
            codeDiff: '',
            fileContents: { [item.targetFile]: fileContentsMap[item.targetFile] || '' },
            existingTests: [],
            testFramework: profile.testFramework,
            language: profile.language,
          },
        });

        let testCode = agentOutput.result;
        testCode = testCode.replace(/^```(?:typescript|javascript|python|java|ts|js)?\n?/m, '');
        testCode = testCode.replace(/\n?```\s*$/m, '');

        generatedTests.push({
          path: item.testFilePath,
          content: testCode,
        });
        totalTokens += agentOutput.tokensUsed;
        await this.sessionRepo.addTokens(sessionId, agentOutput.tokensUsed);
      }

      await this.sessionRepo.update(sessionId, {
        status: 'REVIEW',
        generatedTests: generatedTests as any,
        metadata: { currentTest: totalItems, totalTests: totalItems, done: true } as any,
      });

      return generatedTests;
    } catch (error) {
      await this.sessionRepo.update(sessionId, {
        status: 'FAILED',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // --- Step 5: Update generated tests (user edits) ---

  async updateGeneratedTests(
    sessionId: string,
    tests: Array<{ path: string; content: string }>,
  ) {
    const session = await this.getSession(sessionId);
    if (session.status !== 'REVIEW') {
      throw new BadRequestException(`Session is in ${session.status} status, expected REVIEW`);
    }

    await this.sessionRepo.update(sessionId, {
      generatedTests: tests as any,
    });

    return tests;
  }

  // --- Step 6: Commit tests to repository ---

  async commitTests(
    sessionId: string,
    options: { createPR?: boolean; commitMessage?: string } = {},
  ) {
    const session = await this.getSession(sessionId);
    if (session.status !== 'REVIEW') {
      throw new BadRequestException(`Session is in ${session.status} status, expected REVIEW`);
    }

    const generatedTests = session.generatedTests as unknown as Array<{
      path: string;
      content: string;
    }>;
    if (!generatedTests?.length) {
      throw new BadRequestException('No generated tests to commit');
    }

    await this.sessionRepo.update(sessionId, { status: 'COMMITTING' });

    try {
      const project = await this.fetchProjectInfo(session.projectId);
      const adapter = await this.createAdapter(project);

      const timestamp = Date.now();
      const branchName = `ai/test-gen-${timestamp}`;

      await adapter.createBranch(
        project.repoOwner,
        project.repoName,
        branchName,
        project.defaultBranch,
      );

      const message =
        options.commitMessage ||
        `test: add AI-generated tests\n\nGenerated ${generatedTests.length} test file(s) via AI Test Generator.\nSession: ${sessionId}`;

      const commitResult = await adapter.commitFiles(
        project.repoOwner,
        project.repoName,
        branchName,
        generatedTests.map((t) => ({ path: t.path, content: t.content })),
        message,
      );

      const updateData: any = {
        status: 'COMMITTED' as const,
        branchName,
        commitSha: commitResult.sha,
        commitUrl: commitResult.url,
      };

      if (options.createPR) {
        const prResult = await adapter.createPullRequest(
          project.repoOwner,
          project.repoName,
          `test: AI-generated tests (${generatedTests.length} files)`,
          `## AI-Generated Tests\n\n` +
          `This PR adds ${generatedTests.length} test file(s) generated by the AI Test Generator.\n\n` +
          `### Files\n${generatedTests.map((t) => `- \`${t.path}\``).join('\n')}\n\n` +
          `### Session\nID: \`${sessionId}\`\n` +
          `Tokens used: ${session.totalTokensUsed}`,
          branchName,
          project.defaultBranch,
        );
        updateData.pullRequestUrl = prResult.url;
      }

      await this.sessionRepo.update(sessionId, updateData);

      this.logger.log(`Tests committed for session ${sessionId}: ${commitResult.sha}`);

      return {
        branchName,
        commitSha: commitResult.sha,
        commitUrl: commitResult.url,
        pullRequestUrl: updateData.pullRequestUrl,
      };
    } catch (error) {
      await this.sessionRepo.update(sessionId, {
        status: 'FAILED',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // --- Helpers ---

  async getSession(id: string) {
    const session = await this.sessionRepo.findById(id);
    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    return session;
  }

  async getSessionsByProject(projectId: string) {
    return this.sessionRepo.findByProject(projectId);
  }

  async getProjectProfile(projectId: string) {
    const profile = await this.profileRepo.findByProjectId(projectId);
    if (!profile) {
      throw new NotFoundException(`No profile found for project ${projectId}`);
    }
    return profile;
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
