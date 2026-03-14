import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChecklistGeneratorAgent } from './checklist-generator.agent';
import { AgentOutput, ChecklistGenInput } from '../types';

@Injectable()
export class ChecklistGeneratorService {
  private readonly logger = new Logger(ChecklistGeneratorService.name);
  private readonly agent: ChecklistGeneratorAgent;

  constructor(private readonly configService: ConfigService) {
    this.agent = new ChecklistGeneratorAgent(configService);
  }

  async generate(input: ChecklistGenInput): Promise<AgentOutput> {
    this.logger.log(`Generating checklist for project ${input.projectId}`);

    try {
      const output = await this.agent.run(input);
      this.logger.log(`Checklist generation completed: tokens=${output.tokensUsed}`);
      return output;
    } catch (error) {
      this.logger.error(`Checklist generation failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }
}
