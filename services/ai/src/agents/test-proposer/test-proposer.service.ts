import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TestProposerAgent } from './test-proposer.agent';
import { AgentOutput, TestProposalInput } from '../types';

@Injectable()
export class TestProposerService {
  private readonly logger = new Logger(TestProposerService.name);
  private readonly agent: TestProposerAgent;

  constructor(private readonly configService: ConfigService) {
    this.agent = new TestProposerAgent(configService);
  }

  async propose(input: TestProposalInput): Promise<AgentOutput> {
    this.logger.log(`Proposing tests for project ${input.projectId}`);

    try {
      const output = await this.agent.run(input);
      this.logger.log(
        `Test proposal completed: tokens=${output.tokensUsed}, model=${output.model}`,
      );
      return output;
    } catch (error) {
      this.logger.error(`Test proposal failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }
}
