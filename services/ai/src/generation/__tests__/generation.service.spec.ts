import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GenerationType } from '../../../generated/prisma';
import { GenerationService } from '../generation.service';
import { GenerationRepository } from '../generation.repository';
import { TestGeneratorService } from '../../agents/test-generator/test-generator.service';
import { BugDetectorService } from '../../agents/bug-detector/bug-detector.service';
import { FlakyDetectorService } from '../../agents/flaky-detector/flaky-detector.service';
import { CoverageAdvisorService } from '../../agents/coverage-advisor/coverage-advisor.service';
import { GenerationCompletedEvent } from '../events/generation-completed.event';
import { CreateGenerationDto } from '../dto/create-generation.dto';
import { UpdateFeedbackDto } from '../dto/update-feedback.dto';

describe('GenerationService', () => {
  let service: GenerationService;
  let repository: jest.Mocked<GenerationRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let testGeneratorService: jest.Mocked<TestGeneratorService>;
  let bugDetectorService: jest.Mocked<BugDetectorService>;
  let flakyDetectorService: jest.Mocked<FlakyDetectorService>;
  let coverageAdvisorService: jest.Mocked<CoverageAdvisorService>;

  const mockGeneration = {
    id: 'gen-1',
    projectId: 'project-1',
    type: GenerationType.TEST_GEN,
    inputContext: { codeDiff: 'diff content' },
    output: 'generated test code',
    model: 'o3',
    tokensUsed: 1500,
    accepted: null,
    feedback: null,
    createdAt: new Date('2024-01-01'),
  };

  const mockAgentOutput = {
    result: 'generated test code',
    model: 'o3',
    tokensUsed: 1500,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerationService,
        {
          provide: GenerationRepository,
          useValue: {
            findById: jest.fn(),
            findByProjectId: jest.fn(),
            findByType: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            countByProjectId: jest.fn(),
            getStatsByProjectId: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: TestGeneratorService,
          useValue: {
            generate: jest.fn(),
          },
        },
        {
          provide: BugDetectorService,
          useValue: {
            detect: jest.fn(),
          },
        },
        {
          provide: FlakyDetectorService,
          useValue: {
            analyze: jest.fn(),
          },
        },
        {
          provide: CoverageAdvisorService,
          useValue: {
            advise: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GenerationService>(GenerationService);
    repository = module.get(GenerationRepository) as jest.Mocked<GenerationRepository>;
    eventEmitter = module.get(EventEmitter2) as jest.Mocked<EventEmitter2>;
    testGeneratorService = module.get(TestGeneratorService) as jest.Mocked<TestGeneratorService>;
    bugDetectorService = module.get(BugDetectorService) as jest.Mocked<BugDetectorService>;
    flakyDetectorService = module.get(FlakyDetectorService) as jest.Mocked<FlakyDetectorService>;
    coverageAdvisorService = module.get(CoverageAdvisorService) as jest.Mocked<CoverageAdvisorService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateGenerationDto = {
      projectId: 'project-1',
      type: GenerationType.TEST_GEN,
      inputContext: {
        codeDiff: 'diff content',
        fileContents: {},
        existingTests: [],
        testFramework: 'jest',
        language: 'typescript',
      },
    };

    it('should create a generation using the test generator agent', async () => {
      testGeneratorService.generate.mockResolvedValue(mockAgentOutput);
      repository.create.mockResolvedValue(mockGeneration);

      const result = await service.create(createDto);

      expect(result.id).toBe('gen-1');
      expect(result.output).toBe('generated test code');
      expect(result.model).toBe('o3');
      expect(result.tokensUsed).toBe(1500);
      expect(testGeneratorService.generate).toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          type: GenerationType.TEST_GEN,
          output: 'generated test code',
          model: 'o3',
          tokensUsed: 1500,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        GenerationCompletedEvent.EVENT_NAME,
        expect.any(GenerationCompletedEvent),
      );
    });

    it('should use bug detector for BUG_DETECT type', async () => {
      const bugDto: CreateGenerationDto = {
        projectId: 'project-1',
        type: GenerationType.BUG_DETECT,
        inputContext: {
          codeDiff: 'diff',
          testResults: [],
          existingCodeContext: {},
        },
      };

      bugDetectorService.detect.mockResolvedValue(mockAgentOutput);
      repository.create.mockResolvedValue({
        ...mockGeneration,
        type: GenerationType.BUG_DETECT,
      });

      await service.create(bugDto);

      expect(bugDetectorService.detect).toHaveBeenCalled();
    });

    it('should use flaky detector for FLAKY_DETECT type', async () => {
      const flakyDto: CreateGenerationDto = {
        projectId: 'project-1',
        type: GenerationType.FLAKY_DETECT,
        inputContext: {
          testHistory: [],
          testResults: [],
        },
      };

      flakyDetectorService.analyze.mockResolvedValue(mockAgentOutput);
      repository.create.mockResolvedValue({
        ...mockGeneration,
        type: GenerationType.FLAKY_DETECT,
      });

      await service.create(flakyDto);

      expect(flakyDetectorService.analyze).toHaveBeenCalled();
    });

    it('should use coverage advisor for COVERAGE_ADVICE type', async () => {
      const coverageDto: CreateGenerationDto = {
        projectId: 'project-1',
        type: GenerationType.COVERAGE_ADVICE,
        inputContext: {
          coverageData: { totalLines: 100, coveredLines: 50, percentage: 50, byFile: {} },
          uncoveredFiles: [],
          codeContent: {},
        },
      };

      coverageAdvisorService.advise.mockResolvedValue(mockAgentOutput);
      repository.create.mockResolvedValue({
        ...mockGeneration,
        type: GenerationType.COVERAGE_ADVICE,
      });

      await service.create(coverageDto);

      expect(coverageAdvisorService.advise).toHaveBeenCalled();
    });

    it('should throw BadRequestException when agent fails', async () => {
      testGeneratorService.generate.mockRejectedValue(new Error('LLM API error'));

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByProject', () => {
    it('should return generations for a project', async () => {
      repository.findByProjectId.mockResolvedValue([mockGeneration]);

      const result = await service.findByProject('project-1');

      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe('project-1');
      expect(repository.findByProjectId).toHaveBeenCalledWith('project-1', { type: undefined });
    });

    it('should filter by type when provided', async () => {
      repository.findByProjectId.mockResolvedValue([mockGeneration]);

      await service.findByProject('project-1', GenerationType.TEST_GEN);

      expect(repository.findByProjectId).toHaveBeenCalledWith('project-1', {
        type: GenerationType.TEST_GEN,
      });
    });

    it('should return empty array when no generations found', async () => {
      repository.findByProjectId.mockResolvedValue([]);

      const result = await service.findByProject('project-2');

      expect(result).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return generation by ID', async () => {
      repository.findById.mockResolvedValue(mockGeneration);

      const result = await service.findById('gen-1');

      expect(result.id).toBe('gen-1');
    });

    it('should throw NotFoundException if generation does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateFeedback', () => {
    const feedbackDto: UpdateFeedbackDto = {
      accepted: true,
      feedback: 'Great tests!',
    };

    it('should update feedback and return updated generation', async () => {
      repository.findById.mockResolvedValue(mockGeneration);
      repository.update.mockResolvedValue({
        ...mockGeneration,
        accepted: true,
        feedback: 'Great tests!',
      });

      const result = await service.updateFeedback('gen-1', feedbackDto);

      expect(result.accepted).toBe(true);
      expect(result.feedback).toBe('Great tests!');
      expect(repository.update).toHaveBeenCalledWith('gen-1', {
        accepted: true,
        feedback: 'Great tests!',
      });
    });

    it('should throw NotFoundException if generation does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.updateFeedback('nonexistent', feedbackDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('should return generation statistics', async () => {
      repository.getStatsByProjectId.mockResolvedValue({
        total: 10,
        byType: [
          { type: GenerationType.TEST_GEN, _count: 5 },
          { type: GenerationType.BUG_DETECT, _count: 3 },
          { type: GenerationType.COVERAGE_ADVICE, _count: 2 },
        ],
        accepted: 6,
        rejected: 2,
        pending: 2,
        totalTokens: 15000,
      });

      const result = await service.getStats('project-1');

      expect(result.totalGenerations).toBe(10);
      expect(result.byType).toEqual({
        TEST_GEN: 5,
        BUG_DETECT: 3,
        COVERAGE_ADVICE: 2,
      });
      expect(result.acceptedCount).toBe(6);
      expect(result.rejectedCount).toBe(2);
      expect(result.pendingCount).toBe(2);
      expect(result.totalTokensUsed).toBe(15000);
    });
  });
});
