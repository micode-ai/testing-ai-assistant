import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GenerationType } from '../../generated/prisma';
import { GenerationRepository } from './generation.repository';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { GenerationEntity } from './entities/generation.entity';
import { GenerationStatsDto } from './dto/generation-response.dto';
import { GenerationCompletedEvent } from './events/generation-completed.event';
import { TestGeneratorService } from '../agents/test-generator/test-generator.service';
import { BugDetectorService } from '../agents/bug-detector/bug-detector.service';
import { FlakyDetectorService } from '../agents/flaky-detector/flaky-detector.service';
import { CoverageAdvisorService } from '../agents/coverage-advisor/coverage-advisor.service';
import { ChecklistGeneratorService } from '../agents/checklist-generator/checklist-generator.service';
import { ChecklistTestGeneratorService } from '../agents/checklist-test-generator/checklist-test-generator.service';
import { AgentOutput } from '../agents/types';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly generationRepository: GenerationRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly testGeneratorService: TestGeneratorService,
    private readonly bugDetectorService: BugDetectorService,
    private readonly flakyDetectorService: FlakyDetectorService,
    private readonly coverageAdvisorService: CoverageAdvisorService,
    private readonly checklistGeneratorService: ChecklistGeneratorService,
    private readonly checklistTestGeneratorService: ChecklistTestGeneratorService,
  ) {}

  async create(dto: CreateGenerationDto): Promise<GenerationEntity> {
    this.logger.log(`Starting AI generation: type=${dto.type}, project=${dto.projectId}`);

    let agentOutput: AgentOutput;

    try {
      agentOutput = await this.runAgent(dto.type, dto.projectId, dto.inputContext);
    } catch (error) {
      this.logger.error(`AI generation failed: ${(error as Error).message}`, (error as Error).stack);
      throw new BadRequestException(`AI generation failed: ${(error as Error).message}`);
    }

    const generation = await this.generationRepository.create({
      projectId: dto.projectId,
      type: dto.type,
      inputContext: dto.inputContext as any,
      output: agentOutput.result,
      model: agentOutput.model,
      tokensUsed: agentOutput.tokensUsed,
    });

    this.logger.log(`AI generation completed: id=${generation.id}, tokens=${agentOutput.tokensUsed}`);

    this.eventEmitter.emit(
      GenerationCompletedEvent.EVENT_NAME,
      new GenerationCompletedEvent(
        generation.id,
        generation.projectId,
        generation.type,
        generation.model,
        generation.tokensUsed,
      ),
    );

    return new GenerationEntity(generation);
  }

  async findByProject(
    projectId: string,
    type?: GenerationType,
  ): Promise<GenerationEntity[]> {
    const generations = await this.generationRepository.findByProjectId(projectId, { type });
    return generations.map((g) => new GenerationEntity(g));
  }

  async findById(id: string): Promise<GenerationEntity> {
    const generation = await this.generationRepository.findById(id);
    if (!generation) {
      throw new NotFoundException(`Generation with ID "${id}" not found`);
    }
    return new GenerationEntity(generation);
  }

  async updateFeedback(id: string, dto: UpdateFeedbackDto): Promise<GenerationEntity> {
    const existing = await this.findById(id);

    const updated = await this.generationRepository.update(id, {
      accepted: dto.accepted,
      feedback: dto.feedback,
    });

    this.logger.log(
      `Generation feedback updated: id=${id}, accepted=${dto.accepted}`,
    );

    return new GenerationEntity(updated);
  }

  async getStats(projectId: string): Promise<GenerationStatsDto> {
    const stats = await this.generationRepository.getStatsByProjectId(projectId);

    const byType: Record<string, number> = {};
    for (const entry of stats.byType) {
      byType[entry.type] = entry._count;
    }

    return {
      totalGenerations: stats.total,
      byType,
      acceptedCount: stats.accepted,
      rejectedCount: stats.rejected,
      pendingCount: stats.pending,
      totalTokensUsed: stats.totalTokens,
    };
  }

  private async runAgent(
    type: GenerationType,
    projectId: string,
    inputContext: Record<string, unknown>,
  ): Promise<AgentOutput> {
    const input = { projectId, context: inputContext };

    switch (type) {
      case GenerationType.TEST_GEN:
        return this.testGeneratorService.generate(input as any);
      case GenerationType.BUG_DETECT:
        return this.bugDetectorService.detect(input as any);
      case GenerationType.FLAKY_DETECT:
        return this.flakyDetectorService.analyze(input as any);
      case GenerationType.COVERAGE_ADVICE:
        return this.coverageAdvisorService.advise(input as any);
      case GenerationType.CHECKLIST_GEN:
        return this.checklistGeneratorService.generate(input as any);
      case GenerationType.CHECKLIST_TEST_GEN:
        return this.checklistTestGeneratorService.generate(input as any);
      default:
        throw new BadRequestException(`Unsupported generation type: ${type}`);
    }
  }
}
