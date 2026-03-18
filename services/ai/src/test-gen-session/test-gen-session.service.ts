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
import { cleanGeneratedTest } from './test-cleanup.util';
import { LocalValidatorService } from './local-validator.service';
import { formatErrorsForLLM } from './validation-error-parser.util';

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
    private readonly localValidator: LocalValidatorService,
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

  /**
   * Regenerate specific items (new or existing) within a completed session.
   * Sets status to GENERATING, runs generation for selected items, then validates.
   */
  async startRegeneration(sessionId: string, itemIds: string[]) {
    const session = await this.getSession(sessionId);

    // Allow regeneration from REVIEW, COMMITTED, or AWAITING_APPROVAL states
    const allowedStatuses = ['REVIEW', 'COMMITTED', 'AWAITING_APPROVAL'];
    if (!allowedStatuses.includes(session.status as string)) {
      throw new BadRequestException(
        `Cannot regenerate from status ${session.status}. Allowed: ${allowedStatuses.join(', ')}`,
      );
    }

    const proposal = session.proposal as unknown as TestProposal;
    if (!proposal?.items) {
      throw new BadRequestException('No proposal found in session');
    }

    // Find items to regenerate
    const selectedItems = proposal.items.filter((item) => itemIds.includes(item.id));
    if (selectedItems.length === 0) {
      throw new BadRequestException('No matching items found');
    }

    // Update session: set approved items to the selected ones, status to GENERATING
    await this.sessionRepo.update(sessionId, {
      approvedItems: selectedItems as any,
      status: 'GENERATING',
      metadata: { phase: 'regenerating', itemCount: selectedItems.length } as any,
    });

    // Fire async
    this.generateApprovedTests(sessionId).catch((err) => {
      this.logger.error(`Regeneration failed for session ${sessionId}: ${err.message}`);
    });

    return { status: 'GENERATING', sessionId, itemCount: selectedItems.length };
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

      // Fetch all target files + gather import paths
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

      // Extract local imports from all target files and fetch them
      const importPaths = this.extractImportPaths(fileContentsMap, targetFiles);
      if (importPaths.length > 0) {
        const importContents = await adapter.getMultipleFiles(
          project.repoOwner,
          project.repoName,
          project.defaultBranch,
          importPaths.slice(0, 20), // limit to 20 imported files
        );
        for (const file of importContents) {
          fileContentsMap[file.path] = file.content;
        }
      }

      // Fetch existing test files as style examples (up to 3)
      const existingTestFiles = (profile.testPatterns as any)?.existingTests || [];
      const exampleTests: string[] = [];
      if (existingTestFiles.length > 0) {
        const sampleTestPaths = existingTestFiles.slice(0, 3);
        const testContents = await adapter.getMultipleFiles(
          project.repoOwner,
          project.repoName,
          project.defaultBranch,
          sampleTestPaths,
        );
        for (const file of testContents) {
          exampleTests.push(`// Example from ${file.path}:\n${file.content.slice(0, 2000)}`);
        }
      }

      const generatedTests: Array<{ path: string; content: string }> = [];
      let totalTokens = 0;
      const totalItems = approvedItems.length;

      for (let i = 0; i < approvedItems.length; i++) {
        const item = approvedItems[i];

        await this.sessionRepo.update(sessionId, {
          metadata: {
            currentTest: i + 1,
            totalTests: totalItems,
            currentFile: item.testFilePath,
            phase: 'generating',
          } as any,
        });

        // Check if cancelled
        const currentSession = await this.sessionRepo.findById(sessionId);
        if (currentSession?.status === 'CANCELLED') {
          this.logger.log(`Session ${sessionId} was cancelled, stopping generation`);
          return generatedTests;
        }

        const updateProgress = async (step: string) => {
          await this.sessionRepo.update(sessionId, {
            metadata: {
              currentTest: i + 1,
              totalTests: totalItems,
              currentFile: item.testFilePath,
              phase: 'generating',
              step,
            } as any,
          });
        };

        this.logger.log(`Generating test ${i + 1}/${totalItems}: ${item.testFilePath}`);

        // Step 1: Collecting context
        await updateProgress('collecting_context');
        const targetContent = fileContentsMap[item.targetFile] || '';
        const relatedImports = this.getRelatedImports(targetContent, fileContentsMap, item.targetFile);

        const contextFiles: Record<string, string> = {
          [item.targetFile]: targetContent,
          ...relatedImports,
        };

        const importMap = Object.keys(contextFiles).reduce(
          (acc, filePath) => {
            acc[filePath] = this.calculateRelativeImport(item.testFilePath, filePath);
            return acc;
          },
          {} as Record<string, string>,
        );

        const importInstructions =
          `IMPORT PATHS (use these EXACT paths in your imports):\n` +
          Object.entries(importMap)
            .map(([file, relPath]) => `  ${file} → import from '${relPath}'`)
            .join('\n');

        // Step 2: AI analyzing code
        await updateProgress('analyzing');
        const agentOutput = await this.testGeneratorService.generateFast({
          projectId: session.projectId,
          context: {
            codeDiff: importInstructions,
            fileContents: contextFiles,
            existingTests: exampleTests,
            testFramework: profile.testFramework,
            language: profile.language,
          },
        });

        // Step 3: Post-processing
        await updateProgress('post_processing');
        let testCode = agentOutput.result;
        testCode = testCode.replace(/^```(?:typescript|javascript|python|java|ts|js)?\n?/m, '');
        testCode = testCode.replace(/\n?```\s*$/m, '');
        testCode = cleanGeneratedTest(testCode);
        testCode = this.fixImportPaths(testCode, importMap);
        totalTokens += agentOutput.tokensUsed;

        // Step 4: LLM validation pass
        await updateProgress('llm_review');
        const validatedCode = await this.validateAndFix(
          testCode,
          contextFiles,
          item.testFilePath,
          importMap,
          session.projectId,
        );
        if (validatedCode.tokensUsed > 0) {
          totalTokens += validatedCode.tokensUsed;
        }

        generatedTests.push({
          path: item.testFilePath,
          content: validatedCode.code,
        });
        await this.sessionRepo.addTokens(sessionId, totalTokens);
      }

      // Merge with existing tests (for regeneration: replace matched, keep others)
      const existingTests = (session.generatedTests as unknown as Array<{ path: string; content: string }>) || [];
      const newTestPaths = new Set(generatedTests.map((t) => t.path));
      const mergedTests = [
        ...existingTests.filter((t) => !newTestPaths.has(t.path)),
        ...generatedTests,
      ];

      // --- Validation phase ---
      await this.sessionRepo.update(sessionId, {
        status: 'VALIDATING',
        generatedTests: mergedTests as any,
        metadata: { phase: 'cloning', totalTests: totalItems } as any,
      });

      const validatedTests = await this.runLocalValidation(
        sessionId,
        mergedTests,
        project,
        profile,
      );

      await this.sessionRepo.update(sessionId, {
        status: 'REVIEW',
        generatedTests: validatedTests as any,
        metadata: { currentTest: totalItems, totalTests: totalItems, done: true, validationPassed: true } as any,
      });

      return validatedTests;
    } catch (error) {
      await this.sessionRepo.update(sessionId, {
        status: 'FAILED',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // --- Step 5: Update generated tests (user edits) ---

  async cancelSession(sessionId: string) {
    const session = await this.getSession(sessionId);
    const terminalStatuses = ['COMMITTED', 'CANCELLED', 'FAILED'];
    if (terminalStatuses.includes(session.status as string)) {
      throw new BadRequestException(`Session is already in terminal status: ${session.status}`);
    }

    await this.sessionRepo.update(sessionId, {
      status: 'CANCELLED',
      metadata: { cancelledAt: new Date().toISOString(), previousStatus: session.status } as any,
    });

    this.logger.log(`Session ${sessionId} cancelled from status ${session.status}`);
    return { status: 'CANCELLED', sessionId };
  }

  async skipValidation(sessionId: string) {
    const session = await this.getSession(sessionId);
    if (session.status !== 'VALIDATING' && session.status !== 'GENERATING') {
      throw new BadRequestException(`Cannot skip validation from status ${session.status}`);
    }

    await this.sessionRepo.update(sessionId, {
      status: 'REVIEW',
      metadata: { phase: 'validation_skipped', validationPassed: false } as any,
    });

    return { status: 'REVIEW', sessionId };
  }

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

  /**
   * Extract local import paths from source files and resolve them to repo paths.
   */
  /**
   * Calculate relative import path from a test file to a source file.
   * e.g., test: "src/agents/__tests__/router.test.ts", source: "src/agents/router.agent.ts"
   * → "../router.agent"
   */
  private calculateRelativeImport(fromFile: string, toFile: string): string {
    const fromParts = fromFile.split('/').slice(0, -1); // directory of test file
    const toParts = toFile.split('/');
    const toFileName = toParts.pop()!;
    const toDir = toParts;

    // Find common prefix length
    let common = 0;
    while (common < fromParts.length && common < toDir.length && fromParts[common] === toDir[common]) {
      common++;
    }

    const ups = fromParts.length - common;
    const downs = toDir.slice(common);

    const prefix = ups === 0 ? './' : '../'.repeat(ups);
    const path = [...downs, toFileName.replace(/\.(ts|tsx|js|jsx)$/, '')].join('/');

    return prefix + path;
  }

  /**
   * Programmatically fix import paths in generated test code.
   * Replaces wrong relative paths with correct ones based on the import map.
   */
  private fixImportPaths(code: string, importMap: Record<string, string>): string {
    let result = code;

    for (const [filePath, correctImport] of Object.entries(importMap)) {
      // Extract the filename without extension for matching
      const baseName = filePath.split('/').pop()!.replace(/\.(ts|tsx|js|jsx)$/, '');

      // Match any import from a path ending with this filename
      const importRegex = new RegExp(
        `(from\\s+['"])([^'"]*\\/${escapeRegexStr(baseName)}|\\.\\.?\\/[^'"]*${escapeRegexStr(baseName)})(['"])`,
        'g',
      );

      result = result.replace(importRegex, `$1${correctImport}$3`);
    }

    return result;
  }

  /**
   * Validate generated test code and fix issues using fast LLM.
   */
  private async validateAndFix(
    testCode: string,
    contextFiles: Record<string, string>,
    testFilePath: string,
    importMap: Record<string, string>,
    projectId: string,
  ): Promise<{ code: string; tokensUsed: number }> {
    const contextSummary = Object.entries(contextFiles)
      .map(([path, content]) => {
        // Extract exports from source files
        const exports = content.match(/export\s+(class|interface|type|function|const|enum|async function)\s+(\w+)/g) || [];
        return `File: ${path} (import as '${importMap[path] || path}')\n  Exports: ${exports.join(', ') || 'default export'}`;
      })
      .join('\n');

    const validationPrompt =
      `Review this test file for TypeScript/ESLint errors and fix ALL issues.\n\n` +
      `Test file location: ${testFilePath}\n\n` +
      `Available source files and their exports:\n${contextSummary}\n\n` +
      `Import path mapping (use EXACT paths):\n${Object.entries(importMap).map(([f, p]) => `  ${f} → '${p}'`).join('\n')}\n\n` +
      `RULES:\n` +
      `- Fix ALL incorrect import paths using the mapping above\n` +
      `- Remove any unused imports or variables\n` +
      `- Ensure all mock return values match the actual function return types\n` +
      `- Ensure all required interface properties are included in mock objects\n` +
      `- Do NOT use @ts-expect-error or @ts-ignore\n` +
      `- Do NOT use NodeJS global types directly\n` +
      `- Output ONLY the corrected test code, nothing else\n\n` +
      `Test code to fix:\n\`\`\`typescript\n${testCode}\n\`\`\``;

    try {
      const { HumanMessage, SystemMessage } = await import('@langchain/core/messages');
      const { ChatOpenAI } = await import('@langchain/openai');
      const { ConfigService } = await import('@nestjs/config');

      // Use the existing fast model from the test generator service
      const response = await this.testGeneratorService.generateFast({
        projectId,
        context: {
          codeDiff: validationPrompt,
          fileContents: contextFiles,
          existingTests: [],
          testFramework: 'jest',
          language: 'typescript',
        },
      });

      let fixedCode = response.result;
      fixedCode = fixedCode.replace(/^```(?:typescript|javascript|ts|js)?\n?/m, '');
      fixedCode = fixedCode.replace(/\n?```\s*$/m, '');
      fixedCode = cleanGeneratedTest(fixedCode);
      fixedCode = this.fixImportPaths(fixedCode, importMap);

      return { code: fixedCode, tokensUsed: response.tokensUsed };
    } catch (error) {
      this.logger.warn(`Validation pass failed, using original code: ${(error as Error).message}`);
      return { code: testCode, tokensUsed: 0 };
    }
  }

  /**
   * Clone repo locally, run tsc + eslint on generated tests.
   * If errors found, feed them to LLM and retry up to 3 times.
   */
  private async runLocalValidation(
    sessionId: string,
    tests: Array<{ path: string; content: string }>,
    project: ProjectInfo,
    profile: ProjectProfile,
  ): Promise<Array<{ path: string; content: string }>> {
    let currentTests = [...tests];
    const maxAttempts = 3;

    try {
      const token = await this.gitAdapterFactory.getOrgToken(
        project.orgId,
        project.repoProvider as RepoProvider,
      );

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Check if cancelled
        const currentSession = await this.sessionRepo.findById(sessionId);
        if (currentSession?.status === 'CANCELLED') {
          this.logger.log(`Session ${sessionId} was cancelled, stopping validation`);
          return currentTests;
        }

        this.logger.log(`Validation attempt ${attempt}/${maxAttempts}`);

        const result = await this.localValidator.validate({
          repoUrl: project.repoUrl,
          branch: project.defaultBranch,
          token,
          provider: project.repoProvider as 'GITHUB' | 'GITLAB' | 'BITBUCKET',
          packageManager: profile.packageManager,
          tests: currentTests,
          onProgress: (phase) => {
            this.sessionRepo.update(sessionId, {
              metadata: {
                phase,
                validationAttempt: attempt,
                maxAttempts,
              } as any,
            }).catch(() => {});
          },
        });

        if (result.valid) {
          this.logger.log(`Validation passed on attempt ${attempt}`);
          await this.sessionRepo.update(sessionId, {
            metadata: {
              phase: 'validation_passed',
              validationAttempt: attempt,
              maxAttempts,
            } as any,
          });
          return currentTests;
        }

        this.logger.log(`Validation found ${result.errors.length} error(s), attempt ${attempt}/${maxAttempts}`);

        if (attempt >= maxAttempts) {
          this.logger.warn(`Validation failed after ${maxAttempts} attempts, proceeding with best effort`);
          await this.sessionRepo.update(sessionId, {
            metadata: {
              phase: 'validation_failed',
              validationAttempt: attempt,
              maxAttempts,
              errorCount: result.errors.length,
              validationPassed: false,
            } as any,
          });
          return currentTests;
        }

        // Fix errors with LLM
        await this.sessionRepo.update(sessionId, {
          metadata: {
            phase: 'fixing',
            validationAttempt: attempt,
            maxAttempts,
            errorCount: result.errors.length,
          } as any,
        });

        // Group errors by file
        const errorsByFile = new Map<string, typeof result.errors>();
        for (const err of result.errors) {
          const normalizedFile = currentTests.find(
            (t) => err.file.endsWith(t.path) || err.file === t.path,
          )?.path || err.file;
          if (!errorsByFile.has(normalizedFile)) {
            errorsByFile.set(normalizedFile, []);
          }
          errorsByFile.get(normalizedFile)!.push(err);
        }

        // Fix each file with errors
        for (const testFile of currentTests) {
          const fileErrors = errorsByFile.get(testFile.path);
          if (!fileErrors || fileErrors.length === 0) continue;

          const errorPrompt = formatErrorsForLLM(fileErrors, testFile.content);

          try {
            const fixOutput = await this.testGeneratorService.generateFast({
              projectId: project.id,
              context: {
                codeDiff: errorPrompt,
                fileContents: { [testFile.path]: testFile.content },
                existingTests: [],
                testFramework: profile.testFramework,
                language: profile.language,
              },
            });

            let fixedCode = fixOutput.result;
            fixedCode = fixedCode.replace(/^```(?:typescript|javascript|ts|js)?\n?/m, '');
            fixedCode = fixedCode.replace(/\n?```\s*$/m, '');
            fixedCode = cleanGeneratedTest(fixedCode);

            testFile.content = fixedCode;
            await this.sessionRepo.addTokens(sessionId, fixOutput.tokensUsed);
          } catch (err) {
            this.logger.warn(`Failed to fix ${testFile.path}: ${(err as Error).message}`);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Local validation failed, proceeding without validation: ${(error as Error).message}`);
      await this.sessionRepo.update(sessionId, {
        metadata: {
          phase: 'validation_skipped',
          validationError: (error as Error).message,
        } as any,
      });
    }

    return currentTests;
  }

  private extractImportPaths(
    fileContentsMap: Record<string, string>,
    targetFiles: string[],
  ): string[] {
    const importPaths = new Set<string>();
    const importRegex = /from\s+['"](\.[^'"]+)['"]/g;

    for (const targetFile of targetFiles) {
      const content = fileContentsMap[targetFile];
      if (!content) continue;

      const dir = targetFile.split('/').slice(0, -1).join('/');
      let match: RegExpExecArray | null;

      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        const resolved = this.resolveImportPath(dir, importPath);
        if (resolved) importPaths.add(resolved);
      }
    }

    // Remove files we already have
    for (const existing of Object.keys(fileContentsMap)) {
      importPaths.delete(existing);
    }

    return Array.from(importPaths);
  }

  /**
   * Resolve a relative import to possible file paths.
   */
  private resolveImportPath(dir: string, importPath: string): string | null {
    // Normalize: ./foo or ../foo
    const parts = [...dir.split('/'), ...importPath.split('/')].filter(Boolean);
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') { resolved.pop(); continue; }
      resolved.push(part);
    }
    const base = resolved.join('/');

    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      return `${base}${ext}`;
    }
    return `${base}.ts`;
  }

  /**
   * Get imported files' content for a given source file.
   */
  private getRelatedImports(
    sourceContent: string,
    allFiles: Record<string, string>,
    sourceFile: string,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    const importRegex = /from\s+['"](\.[^'"]+)['"]/g;
    const dir = sourceFile.split('/').slice(0, -1).join('/');

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(sourceContent)) !== null) {
      const importPath = match[1];
      const resolved = this.resolveImportPath(dir, importPath);
      if (resolved && allFiles[resolved]) {
        result[resolved] = allFiles[resolved];
      }
    }

    return result;
  }
}

function escapeRegexStr(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
