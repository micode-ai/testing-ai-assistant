import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PipelineService } from '../pipeline.service';
import { PipelineRepository } from '../pipeline.repository';

describe('PipelineService', () => {
  let service: PipelineService;
  let repository: PipelineRepository;
  let eventEmitter: EventEmitter2;

  const mockPipeline = {
    id: 'pipeline-1',
    projectId: 'project-1',
    name: 'Main CI Pipeline',
    trigger: 'PUSH' as const,
    cronExpr: null,
    steps: [{ name: 'lint', command: 'npm run lint' }],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: PipelineRepository, useValue: createMock<PipelineRepository>() },
        { provide: EventEmitter2, useValue: createMock<EventEmitter2>() },
      ],
    }).compile();

    service = module.get<PipelineService>(PipelineService);
    repository = module.get<PipelineRepository>(PipelineRepository);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('create', () => {
    it('should create a pipeline and emit event', async () => {
      // Arrange
      const dto = {
        projectId: 'project-1',
        name: 'Main CI Pipeline',
        trigger: 'PUSH' as const,
        steps: [{ name: 'lint', command: 'npm run lint' }],
      };
      jest.spyOn(repository, 'create').mockResolvedValue(mockPipeline);

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result).toEqual(mockPipeline);
      expect(repository.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'pipeline.triggered',
        expect.objectContaining({ aggregateId: mockPipeline.id }),
      );
    });
  });

  describe('findByProject', () => {
    it('should return pipelines for a project', async () => {
      // Arrange
      jest.spyOn(repository, 'findByProjectId').mockResolvedValue([mockPipeline]);

      // Act
      const result = await service.findByProject('project-1');

      // Assert
      expect(result).toEqual([mockPipeline]);
      expect(repository.findByProjectId).toHaveBeenCalledWith('project-1');
    });
  });

  describe('findById', () => {
    it('should return a pipeline by id', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(mockPipeline);

      // Act
      const result = await service.findById('pipeline-1');

      // Assert
      expect(result).toEqual(mockPipeline);
    });

    it('should throw NotFoundException when pipeline does not exist', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a pipeline', async () => {
      // Arrange
      const updatedPipeline = { ...mockPipeline, name: 'Updated Pipeline' };
      jest.spyOn(repository, 'findById').mockResolvedValue(mockPipeline);
      jest.spyOn(repository, 'update').mockResolvedValue(updatedPipeline);

      // Act
      const result = await service.update('pipeline-1', { name: 'Updated Pipeline' });

      // Assert
      expect(result.name).toBe('Updated Pipeline');
      expect(repository.update).toHaveBeenCalledWith('pipeline-1', { name: 'Updated Pipeline' });
    });

    it('should throw NotFoundException when pipeline does not exist', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete a pipeline', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(mockPipeline);
      jest.spyOn(repository, 'delete').mockResolvedValue(mockPipeline);

      // Act
      await service.delete('pipeline-1');

      // Assert
      expect(repository.delete).toHaveBeenCalledWith('pipeline-1');
    });

    it('should throw NotFoundException when pipeline does not exist', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleEnabled', () => {
    it('should toggle the enabled state of a pipeline', async () => {
      // Arrange
      const disabledPipeline = { ...mockPipeline, enabled: false };
      jest.spyOn(repository, 'findById').mockResolvedValue(mockPipeline);
      jest.spyOn(repository, 'update').mockResolvedValue(disabledPipeline);

      // Act
      const result = await service.toggleEnabled('pipeline-1');

      // Assert
      expect(result.enabled).toBe(false);
      expect(repository.update).toHaveBeenCalledWith('pipeline-1', { enabled: false });
    });
  });
});
