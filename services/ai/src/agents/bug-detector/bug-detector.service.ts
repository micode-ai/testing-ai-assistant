import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BugDetectorAgent } from './bug-detector.agent';
import { AgentOutput, BugDetectInput } from '../types';

@Injectable()
export class BugDetectorService {
  private readonly logger = new Logger(BugDetectorService.name);
  private readonly agent: BugDetectorAgent;

  constructor(private readonly configService: ConfigService) {
    this.agent = new BugDetectorAgent(configService);
  }

  async detect(input: BugDetectInput): Promise<AgentOutput> {
    this.logger.log(`Detecting bugs for project ${input.projectId}`);

    try {
      const output = await this.agent.run(input);
      this.logger.log(
        `Bug detection completed: tokens=${output.tokensUsed}, model=${output.model}`,
      );
      return output;
    } catch (error) {
      this.logger.error(`Bug detection failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }
}
