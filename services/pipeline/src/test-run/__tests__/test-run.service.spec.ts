import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TestRunService } from '../test-run.service';
import { TestRunRepository } from '../test-run.repository';

describe('TestRunService', () => {
  let service: TestRunService;
  let repository: TestRunRepository;
  let eventEmitter: EventEmitter2;

  const mockRun = {
    id: 'run-1',
    pipelineId: 'pipeline-1',
    commitSha: 'abc123def456',
    branch: 'main',
    status: 'QUEUED' as const,
    startedAt: null,
    finishedAt: null,
    triggeredBy: 'user-1',
    metadata: {},
    createdAt: new Date(),
  };

  const mockRunningRun = {
    ...mockRun,
    status: 'RUNNING' as const,
    startedAt: new Date(Date.now() - 60000),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestRunService,
        { provide: TestRunRepository, useValue: createMock<TestRunRepository>() },
        { provide: EventEmitter2, useValue: createMock<EventEmitter2>() },
      ],
    }).compile();

    service = module.get<TestRunService>(TestRunService);
    repository = module.get<TestRunRepository>(TestRunRepository);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('create', () => {
    it('should create a test run with QUEUED status', async () => {
      // Arrange
      const dto = {
        pipelineId: 'pipeline-1',
        commitSha: 'abc123def456',
        branch: 'main',
        triggeredBy: 'user-1',
      };
      jest.spyOn(repository, 'create').mockResolvedValue(mockRun);

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result).toEqual(mockRun);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'QUEUED' }),
      );
    });
  });

  describe('start', () => {
    it('should start a queued run', async () => {
      // Arrange
      const startedRun = { ...mockRun, status: 'RUNNING' as const, startedAt: new Date() };
      jest.spyOn(repository, 'findById').mockResolvedValue(mockRun);
      jest.spyOn(repository, 'updateStatus').mockResolvedValue(startedRun);

      // Act
      const result = await service.start('run-1');

      // Assert
      expect(result.status).toBe('RUNNING');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'run.started',
        expect.objectContaining({ aggregateId: 'run-1' }),
      );
    });

    it('should throw BadRequestException when run is not QUEUED', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(mockRunningRun);

      // Act & Assert
      await expect(service.start('run-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('complete', () => {
    it('should complete a running run as PASSED when all results pass', async () => {
      // Arrange
      const runWithResults = {
        ...mockRunningRun,
        results: [
          { id: 'r1', checkType: 'UNIT', status: 'PASSED', summary: 'OK', durationMs: 100, artifactUrl: null, runId: 'run-1', details: {}, createdAt: new Date() },
        ],
      };
      const completedRun = { ...mockRunningRun, status: 'PASSED' as const, finishedAt: new Date() };
      jest.spyOn(repository, 'findByIdWithResults').mockResolvedValue(runWithResults as any);
      jest.spyOn(repository, 'updateStatus').mockResolvedValue(completedRun);

      // Act
      const result = await service.complete('run-1');

      // Assert
      expect(result.status).toBe('PASSED');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'run.completed',
        expect.objectContaining({
          aggregateId: 'run-1',
          payload: expect.objectContaining({ status: 'PASSED' }),
        }),
      );
    });

    it('should complete a running run as FAILED when any result failed', async () => {
      // Arrange
      const runWithResults = {
        ...mockRunningRun,
        results: [
          { id: 'r1', checkType: 'UNIT', status: 'PASSED', summary: 'OK', durationMs: 100, artifactUrl: null, runId: 'run-1', details: {}, createdAt: new Date() },
          { id: 'r2', checkType: 'LINT', status: 'FAILED', summary: 'Lint errors', durationMs: 50, artifactUrl: null, runId: 'run-1', details: {}, createdAt: new Date() },
        ],
      };
      const completedRun = { ...mockRunningRun, status: 'FAILED' as const, finishedAt: new Date() };
      jest.spyOn(repository, 'findByIdWithResults').mockResolvedValue(runWithResults as any);
      jest.spyOn(repository, 'updateStatus').mockResolvedValue(completedRun);

      // Act
      const result = await service.complete('run-1');

      // Assert
      expect(result.status).toBe('FAILED');
    });

    it('should throw NotFoundException when run does not exist', async () => {
      // Arrange
      jest.spyOn(repository, 'findByIdWithResults').mockResolvedValue(null);

      // Act & Assert
      await expect(service.complete('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should cancel a queued run', async () => {
      // Arrange
      const cancelledRun = { ...mockRun, status: 'CANCELLED' as const, finishedAt: new Date() };
      jest.spyOn(repository, 'findById').mockResolvedValue(mockRun);
      jest.spyOn(repository, 'updateStatus').mockResolvedValue(cancelledRun);

      // Act
      const result = await service.cancel('run-1');

      // Assert
      expect(result.status).toBe('CANCELLED');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'run.completed',
        expect.objectContaining({
          payload: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('should throw BadRequestException when run is already completed', async () => {
      // Arrange
      const passedRun = { ...mockRun, status: 'PASSED' as const };
      jest.spyOn(repository, 'findById').mockResolvedValue(passedRun);

      // Act & Assert
      await expect(service.cancel('run-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByPipeline', () => {
    it('should return runs for a pipeline', async () => {
      // Arrange
      jest.spyOn(repository, 'findByPipelineId').mockResolvedValue([mockRun]);

      // Act
      const result = await service.findByPipeline('pipeline-1');

      // Assert
      expect(result).toEqual([mockRun]);
      expect(repository.findByPipelineId).toHaveBeenCalledWith('pipeline-1');
    });
  });

  describe('findById', () => {
    it('should return a run by id', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(mockRun);

      // Act
      const result = await service.findById('run-1');

      // Assert
      expect(result).toEqual(mockRun);
    });

    it('should throw NotFoundException when run does not exist', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
