import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TestGeneratorAgent } from './test-generator.agent';
import { AgentOutput, TestGenInput } from '../types';

@Injectable()
export class TestGeneratorService {
  private readonly logger = new Logger(TestGeneratorService.name);
  private readonly agent: TestGeneratorAgent;

  constructor(private readonly configService: ConfigService) {
    this.agent = new TestGeneratorAgent(configService);
  }

  async generate(input: TestGenInput): Promise<AgentOutput> {
    this.logger.log(`Generating tests for project ${input.projectId}`);

    try {
      const output = await this.agent.run(input);
      this.logger.log(
        `Test generation completed: tokens=${output.tokensUsed}, model=${output.model}`,
      );
      return output;
    } catch (error) {
      this.logger.error(`Test generation failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  /** Fast mode: skip validation/refinement (for batch generation) */
  async generateFast(input: TestGenInput): Promise<AgentOutput> {
    this.logger.log(`Generating tests (fast) for project ${input.projectId}`);

    try {
      const output = await this.agent.runFast(input);
      this.logger.log(
        `Test generation (fast) completed: tokens=${output.tokensUsed}, model=${output.model}`,
      );
      return output;
    } catch (error) {
      this.logger.error(`Test generation (fast) failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }
}
