import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChecklistTestGeneratorAgent } from './checklist-test-generator.agent';
import { AgentOutput, ChecklistTestGenInput } from '../types';

@Injectable()
export class ChecklistTestGeneratorService {
  private readonly logger = new Logger(ChecklistTestGeneratorService.name);
  private readonly agent: ChecklistTestGeneratorAgent;

  constructor(private readonly configService: ConfigService) {
    this.agent = new ChecklistTestGeneratorAgent(configService);
  }

  async generate(input: ChecklistTestGenInput): Promise<AgentOutput> {
    this.logger.log(`Generating Playwright test for: ${input.context.checklistItem.title}`);

    try {
      const output = await this.agent.run(input);
      this.logger.log(`Test generation completed: tokens=${output.tokensUsed}`);
      return output;
    } catch (error) {
      this.logger.error(`Checklist test generation failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }
}
