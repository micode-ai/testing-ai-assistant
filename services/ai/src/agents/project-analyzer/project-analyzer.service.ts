import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectAnalyzerAgent } from './project-analyzer.agent';
import { AgentOutput, ProjectAnalysisInput } from '../types';

@Injectable()
export class ProjectAnalyzerService {
  private readonly logger = new Logger(ProjectAnalyzerService.name);
  private readonly agent: ProjectAnalyzerAgent;

  constructor(private readonly configService: ConfigService) {
    this.agent = new ProjectAnalyzerAgent(configService);
  }

  async analyze(input: ProjectAnalysisInput): Promise<AgentOutput> {
    this.logger.log(`Analyzing project ${input.projectId}`);

    try {
      const output = await this.agent.run(input);
      this.logger.log(
        `Project analysis completed: tokens=${output.tokensUsed}, model=${output.model}`,
      );
      return output;
    } catch (error) {
      this.logger.error(`Project analysis failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }
}
