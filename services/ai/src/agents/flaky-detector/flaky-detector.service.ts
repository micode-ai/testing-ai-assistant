import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlakyDetectorAgent } from './flaky-detector.agent';
import { AgentOutput, FlakyDetectInput } from '../types';

@Injectable()
export class FlakyDetectorService {
  private readonly logger = new Logger(FlakyDetectorService.name);
  private readonly agent: FlakyDetectorAgent;

  constructor(private readonly configService: ConfigService) {
    this.agent = new FlakyDetectorAgent(configService);
  }

  async analyze(input: FlakyDetectInput): Promise<AgentOutput> {
    this.logger.log(`Analyzing flaky tests for project ${input.projectId}`);

    try {
      const output = await this.agent.run(input);
      this.logger.log(
        `Flaky test analysis completed: tokens=${output.tokensUsed}, model=${output.model}`,
      );
      return output;
    } catch (error) {
      this.logger.error(`Flaky test analysis failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }
}
