import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseAgent } from '../base-agent';
import { AgentOutput, TestProposalInput, TestProposal } from '../types';

export class TestProposerAgent extends BaseAgent {
  private readonly logger = new Logger(TestProposerAgent.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  private getLanguageName(locale?: string): string {
    switch (locale) {
      case 'ru': return 'Russian';
      case 'pl': return 'Polish';
      case 'en': return 'English';
      default: return 'English';
    }
  }

  async run(input: TestProposalInput): Promise<AgentOutput> {
    this.logger.log(`Proposing tests for project ${input.projectId}`);

    const { context } = input;

    const fileList = Object.keys(context.fileContents);
    const fileSummaries = Object.entries(context.fileContents)
      .map(([path, content]) => `--- ${path} ---\n${content.slice(0, 2000)}`)
      .join('\n\n');

    const response = await this.model.invoke([
      new SystemMessage(
        `You are a senior test engineer. Analyze the source code and project profile to propose which tests should be written.

For each source file that needs tests, propose a test file with:
- A unique ID (use format: "test-{index}")
- The target source file path
- The proposed test file path (following the project's existing test patterns)
- Test type: "unit", "integration", or "e2e"
- Description of what tests to write
- Rationale for why these tests are important
- Priority: "high" (critical logic, no existing tests), "medium" (important but some coverage exists), "low" (nice to have)
- Estimated number of test cases

Focus on:
1. Files with no existing tests (highest priority)
2. Complex business logic
3. Error handling paths
4. Edge cases in data transformations
${context.focusArea ? `\nUser focus area: ${context.focusArea}` : ''}
${context.recentChanges ? `\nRecent changes to consider:\n${context.recentChanges}` : ''}

IMPORTANT: Write all human-readable text (description, rationale, summary) in ${this.getLanguageName(context.locale)}. Keep file paths, code identifiers, and JSON keys in English.

Respond with ONLY valid JSON:
{
  "items": [
    {
      "id": "test-1",
      "targetFile": "src/example.ts",
      "testFilePath": "src/__tests__/example.spec.ts",
      "testType": "unit",
      "description": "Test the main processing function...",
      "rationale": "This file handles critical business logic...",
      "priority": "high",
      "estimatedTests": 5
    }
  ],
  "summary": "Overview of proposed test plan...",
  "estimatedTokens": 5000
}`,
      ),
      new HumanMessage(
        `Project Profile:\n${JSON.stringify(context.profile, null, 2)}\n\n` +
        `Source Files (${fileList.length}):\n${fileSummaries}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    let proposal: TestProposal;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      proposal = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { items: [], summary: 'Failed to generate proposal', estimatedTokens: 0 };
    } catch {
      proposal = { items: [], summary: 'Failed to parse proposal', estimatedTokens: 0 };
    }

    // Ensure all items have IDs
    proposal.items = proposal.items.map((item, index) => ({
      ...item,
      id: item.id || `test-${index + 1}`,
    }));

    return {
      result: JSON.stringify(proposal),
      model: this.model.modelName || 'o3',
      tokensUsed,
      metadata: { proposal },
    };
  }
}
