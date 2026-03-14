import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoverageAdvisorAgent } from './coverage-advisor.agent';
import { AgentOutput, CoverageAdviceInput } from '../types';

@Injectable()
export class CoverageAdvisorService {
  private readonly logger = new Logger(CoverageAdvisorService.name);
  private readonly agent: CoverageAdvisorAgent;

  constructor(private readonly configService: ConfigService) {
    this.agent = new CoverageAdvisorAgent(configService);
  }

  async advise(input: CoverageAdviceInput): Promise<AgentOutput> {
    this.logger.log(`Generating coverage advice for project ${input.projectId}`);

    try {
      const output = await this.agent.run(input);
      this.logger.log(
        `Coverage advice completed: tokens=${output.tokensUsed}, model=${output.model}`,
      );
      return output;
    } catch (error) {
      this.logger.error(`Coverage advice generation failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }
}
