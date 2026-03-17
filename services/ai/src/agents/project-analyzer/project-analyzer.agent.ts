import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseAgent } from '../base-agent';
import { AgentOutput, ProjectAnalysisInput, ProjectProfile } from '../types';

export class ProjectAnalyzerAgent extends BaseAgent {
  private readonly logger = new Logger(ProjectAnalyzerAgent.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  async run(input: ProjectAnalysisInput): Promise<AgentOutput> {
    this.logger.log(`Analyzing project ${input.projectId}`);

    const { context } = input;

    const response = await this.fastModel.invoke([
      new SystemMessage(
        `You are an expert software engineer analyzing a project repository structure.
Your task is to produce a structured JSON profile of the project.

Analyze the file tree, config files, and existing tests to determine:
1. Primary programming language(s)
2. Test framework (jest, vitest, pytest, junit, mocha, playwright, etc.)
3. Package manager (npm, pnpm, yarn, pip, maven, gradle, etc.)
4. Source code directories vs test directories
5. Test file patterns (e.g., *.spec.ts, *.test.js, test_*.py)
6. Key dependencies (especially test-related ones)
7. Estimated test coverage based on existing test files

Respond with ONLY valid JSON matching this exact structure:
{
  "language": "string",
  "testFramework": "string",
  "packageManager": "string or null",
  "structure": {
    "sourceDirectories": ["string"],
    "testDirectories": ["string"],
    "configFiles": ["string"],
    "totalFiles": number
  },
  "testPatterns": {
    "filePattern": "string",
    "existingTests": ["string"],
    "estimatedCoverage": "string description"
  },
  "dependencies": {
    "runtime": ["string - top 10 only"],
    "devDependencies": ["string - top 10 only"],
    "testRelated": ["string"]
  }
}`,
      ),
      new HumanMessage(
        `File Tree (${context.fileTree.length} entries):\n${context.fileTree.slice(0, 500).join('\n')}\n` +
        (context.fileTree.length > 500 ? `\n... and ${context.fileTree.length - 500} more files\n` : '') +
        `\nConfig Files:\n${Object.entries(context.configFiles)
          .map(([path, content]) => `--- ${path} ---\n${content.slice(0, 3000)}`)
          .join('\n\n')}\n` +
        `\nExisting Test Files:\n${context.existingTestFiles.join('\n')}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    let profile: ProjectProfile;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      profile = jsonMatch ? JSON.parse(jsonMatch[0]) : this.fallbackProfile(context);
    } catch {
      this.logger.warn('Failed to parse LLM response, using fallback profile');
      profile = this.fallbackProfile(context);
    }

    return {
      result: JSON.stringify(profile),
      model: this.fastModel.modelName || 'gpt-4.1-mini',
      tokensUsed,
      metadata: { profile },
    };
  }

  private fallbackProfile(context: ProjectAnalysisInput['context']): ProjectProfile {
    const hasPackageJson = 'package.json' in context.configFiles;
    const hasPyProject = 'pyproject.toml' in context.configFiles || 'setup.py' in context.configFiles;
    const hasPomXml = 'pom.xml' in context.configFiles;

    let language = 'unknown';
    let testFramework = 'unknown';
    let packageManager: string | null = null;

    if (hasPackageJson) {
      language = context.fileTree.some((f) => f.endsWith('.ts')) ? 'typescript' : 'javascript';
      packageManager = context.configFiles['pnpm-lock.yaml'] ? 'pnpm'
        : context.configFiles['yarn.lock'] ? 'yarn' : 'npm';
      try {
        const pkg = JSON.parse(context.configFiles['package.json']);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps['jest']) testFramework = 'jest';
        else if (allDeps['vitest']) testFramework = 'vitest';
        else if (allDeps['mocha']) testFramework = 'mocha';
        else if (allDeps['@playwright/test']) testFramework = 'playwright';
      } catch { /* ignore */ }
    } else if (hasPyProject) {
      language = 'python';
      testFramework = 'pytest';
      packageManager = 'pip';
    } else if (hasPomXml) {
      language = 'java';
      testFramework = 'junit';
      packageManager = 'maven';
    }

    const testFiles = context.existingTestFiles;
    let filePattern = '*.test.*';
    if (testFiles.some((f) => f.includes('.spec.'))) filePattern = '*.spec.*';
    if (testFiles.some((f) => f.startsWith('test_'))) filePattern = 'test_*.*';

    return {
      language,
      testFramework,
      packageManager,
      structure: {
        sourceDirectories: ['src'],
        testDirectories: testFiles.length > 0
          ? [...new Set(testFiles.map((f) => f.split('/').slice(0, -1).join('/')))]
          : ['tests'],
        configFiles: Object.keys(context.configFiles),
        totalFiles: context.fileTree.length,
      },
      testPatterns: {
        filePattern,
        existingTests: testFiles,
        estimatedCoverage: testFiles.length > 0
          ? `${testFiles.length} test files found`
          : 'No test files detected',
      },
      dependencies: {
        runtime: [],
        devDependencies: [],
        testRelated: [],
      },
    };
  }
}
