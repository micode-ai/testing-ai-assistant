import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { PipelineController } from '../pipeline.controller';
import { PipelineService } from '../pipeline.service';

describe('PipelineController', () => {
  let controller: PipelineController;
  let service: PipelineService;

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
      controllers: [PipelineController],
      providers: [
        { provide: PipelineService, useValue: createMock<PipelineService>() },
      ],
    }).compile();

    controller = module.get<PipelineController>(PipelineController);
    service = module.get<PipelineService>(PipelineService);
  });

  describe('create', () => {
    it('should create a pipeline', async () => {
      // Arrange
      const dto = {
        projectId: 'project-1',
        name: 'Main CI Pipeline',
        trigger: 'PUSH' as const,
        steps: [{ name: 'lint', command: 'npm run lint' }],
      };
      jest.spyOn(service, 'create').mockResolvedValue(mockPipeline);

      // Act
      const result = await controller.create(dto);

      // Assert
      expect(result.id).toBe('pipeline-1');
      expect(result.name).toBe('Main CI Pipeline');
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return pipelines filtered by projectId', async () => {
      // Arrange
      jest.spyOn(service, 'findByProject').mockResolvedValue([mockPipeline]);

      // Act
      const result = await controller.findAll('project-1');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe('project-1');
      expect(service.findByProject).toHaveBeenCalledWith('project-1');
    });

    it('should return all pipelines when no projectId is provided', async () => {
      // Arrange
      jest.spyOn(service, 'findAll').mockResolvedValue([mockPipeline]);

      // Act
      const result = await controller.findAll(undefined);

      // Assert
      expect(result).toHaveLength(1);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a pipeline with run count', async () => {
      // Arrange
      jest.spyOn(service, 'findById').mockResolvedValue(mockPipeline);
      jest.spyOn(service, 'getRunCount').mockResolvedValue(10);

      // Act
      const result = await controller.findOne('pipeline-1');

      // Assert
      expect(result.id).toBe('pipeline-1');
      expect(result.runCount).toBe(10);
    });
  });

  describe('update', () => {
    it('should update a pipeline', async () => {
      // Arrange
      const updatedPipeline = { ...mockPipeline, name: 'Updated Pipeline' };
      jest.spyOn(service, 'update').mockResolvedValue(updatedPipeline);

      // Act
      const result = await controller.update('pipeline-1', { name: 'Updated Pipeline' });

      // Assert
      expect(result.name).toBe('Updated Pipeline');
      expect(service.update).toHaveBeenCalledWith('pipeline-1', { name: 'Updated Pipeline' });
    });
  });

  describe('remove', () => {
    it('should delete a pipeline', async () => {
      // Arrange
      jest.spyOn(service, 'delete').mockResolvedValue(undefined);

      // Act
      await controller.remove('pipeline-1');

      // Assert
      expect(service.delete).toHaveBeenCalledWith('pipeline-1');
    });
  });

  describe('toggleEnabled', () => {
    it('should toggle the pipeline enabled state', async () => {
      // Arrange
      const toggledPipeline = { ...mockPipeline, enabled: false };
      jest.spyOn(service, 'toggleEnabled').mockResolvedValue(toggledPipeline);

      // Act
      const result = await controller.toggleEnabled('pipeline-1');

      // Assert
      expect(result.enabled).toBe(false);
      expect(service.toggleEnabled).toHaveBeenCalledWith('pipeline-1');
    });
  });
});
