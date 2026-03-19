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
import { PrismaService } from '../prisma/prisma.service';
import { TestGeneratorService } from '../agents/test-generator/test-generator.service';
import { BugDetectorService } from '../agents/bug-detector/bug-detector.service';
import { FlakyDetectorService } from '../agents/flaky-detector/flaky-detector.service';
import { CoverageAdvisorService } from '../agents/coverage-advisor/coverage-advisor.service';
import { ChecklistGeneratorService } from '../agents/checklist-generator/checklist-generator.service';
import { ChecklistTestGeneratorService } from '../agents/checklist-test-generator/checklist-test-generator.service';
import { ProjectAnalyzerService } from '../agents/project-analyzer/project-analyzer.service';
import { TestProposerService } from '../agents/test-proposer/test-proposer.service';
import { ChecklistItemChatService } from '../agents/checklist-item-chat/checklist-item-chat.service';
import { AgentOutput } from '../agents/types';
import { BugDetectContextService } from './bug-detect-context.service';

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
    private readonly projectAnalyzerService: ProjectAnalyzerService,
    private readonly testProposerService: TestProposerService,
    private readonly checklistItemChatService: ChecklistItemChatService,
    private readonly bugDetectContextService: BugDetectContextService,
    private readonly prisma: PrismaService,
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

    // Also aggregate TestGenSession data
    const [sessionCount, sessionTokensAgg, committedCount] = await Promise.all([
      this.prisma.testGenSession.count({ where: { projectId } }),
      this.prisma.testGenSession.aggregate({
        where: { projectId },
        _sum: { totalTokensUsed: true },
      }),
      this.prisma.testGenSession.count({ where: { projectId, status: 'COMMITTED' } }),
    ]);

    const sessionTokens = sessionTokensAgg._sum.totalTokensUsed || 0;

    const byType: Record<string, number> = {};
    for (const entry of stats.byType) {
      byType[entry.type] = entry._count;
    }
    if (sessionCount > 0) {
      byType['TEST_GEN_SESSION'] = sessionCount;
    }

    const totalGenerations = stats.total + sessionCount;
    const acceptedCount = stats.accepted + committedCount;
    const totalReviewed = acceptedCount + stats.rejected;

    return {
      totalGenerations,
      byType,
      acceptedCount,
      rejectedCount: stats.rejected,
      pendingCount: stats.pending + (sessionCount - committedCount),
      totalTokensUsed: stats.totalTokens + sessionTokens,
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
      case GenerationType.BUG_DETECT: {
        const bugCtx = inputContext as Record<string, unknown>;
        const locale = (bugCtx.locale as string) || undefined;
        let context;

        if (bugCtx.testResults || bugCtx.codeDiff || bugCtx.diff) {
          // Manual override: user provided data explicitly
          let testResults: unknown[] = [];
          if (typeof bugCtx.testResults === 'string') {
            try { testResults = JSON.parse(bugCtx.testResults); } catch { testResults = []; }
          } else if (Array.isArray(bugCtx.testResults)) {
            testResults = bugCtx.testResults;
          }
          context = {
            codeDiff: (bugCtx.codeDiff as string) || (bugCtx.diff as string) || '',
            testResults,
            existingCodeContext: (bugCtx.existingCodeContext as Record<string, string>) || {},
            locale,
          };
        } else {
          // Auto-fetch: get project context from git repo and pipeline
          this.logger.log(`Auto-fetching bug detect context for project ${projectId}`);
          const autoContext = await this.bugDetectContextService.fetchBugDetectContext(projectId);
          context = { ...autoContext, locale };
        }

        return this.bugDetectorService.detect({ projectId, context } as any);
      }
      case GenerationType.FLAKY_DETECT: {
        const flakyCtx = inputContext as Record<string, unknown>;
        const flakyLocale = (flakyCtx.locale as string) || undefined;
        let flakyContext;

        if (Array.isArray(flakyCtx.testHistory) && flakyCtx.testHistory.length > 0) {
          flakyContext = {
            testHistory: flakyCtx.testHistory,
            testResults: Array.isArray(flakyCtx.testResults) ? flakyCtx.testResults : [],
            locale: flakyLocale,
          };
        } else {
          this.logger.log(`Auto-fetching flaky detect history for project ${projectId}`);
          const autoContext = await this.bugDetectContextService.fetchTestHistory(projectId);
          flakyContext = { ...autoContext, locale: flakyLocale };
        }

        return this.flakyDetectorService.analyze({ projectId, context: flakyContext } as any);
      }
      case GenerationType.COVERAGE_ADVICE:
        return this.coverageAdvisorService.advise(input as any);
      case GenerationType.CHECKLIST_GEN:
        return this.checklistGeneratorService.generate(input as any);
      case GenerationType.CHECKLIST_TEST_GEN:
        return this.checklistTestGeneratorService.generate(input as any);
      case GenerationType.PROJECT_ANALYSIS:
        return this.projectAnalyzerService.analyze(input as any);
      case GenerationType.TEST_PROPOSAL:
        return this.testProposerService.propose(input as any);
      case GenerationType.CHECKLIST_ITEM_CHAT:
        return this.checklistItemChatService.chat(input as any);
      default:
        throw new BadRequestException(`Unsupported generation type: ${type}`);
    }
  }
}
