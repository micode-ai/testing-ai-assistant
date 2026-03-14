import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Pipeline, Prisma } from '../../generated/prisma';
import { PipelineRepository } from './pipeline.repository';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { PipelineTriggeredEvent } from './events/pipeline-triggered.event';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreatePipelineDto): Promise<Pipeline> {
    const pipeline = await this.pipelineRepository.create({
      projectId: dto.projectId,
      name: dto.name,
      trigger: dto.trigger,
      cronExpr: dto.cronExpr ?? null,
      steps: dto.steps as unknown as Prisma.InputJsonValue,
      enabled: dto.enabled ?? true,
    } as any);

    this.eventEmitter.emit(
      'pipeline.triggered',
      new PipelineTriggeredEvent(pipeline.id, {
        projectId: pipeline.projectId,
        name: pipeline.name,
        trigger: pipeline.trigger,
      }),
    );

    this.logger.log(`Pipeline created: ${pipeline.id} for project ${pipeline.projectId}`);
    return pipeline;
  }

  async findByProject(projectId: string): Promise<Pipeline[]> {
    return this.pipelineRepository.findByProjectId(projectId);
  }

  async findAll(): Promise<Pipeline[]> {
    return this.pipelineRepository.findAll();
  }

  async findById(id: string): Promise<Pipeline> {
    const pipeline = await this.pipelineRepository.findById(id);
    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }
    return pipeline;
  }

  async update(id: string, dto: UpdatePipelineDto): Promise<Pipeline> {
    await this.findById(id);

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.trigger !== undefined) updateData.trigger = dto.trigger;
    if (dto.cronExpr !== undefined) updateData.cronExpr = dto.cronExpr;
    if (dto.steps !== undefined) updateData.steps = dto.steps;
    if (dto.enabled !== undefined) updateData.enabled = dto.enabled;

    const updated = await this.pipelineRepository.update(id, updateData);
    this.logger.log(`Pipeline updated: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.pipelineRepository.delete(id);
    this.logger.log(`Pipeline deleted: ${id}`);
  }

  async toggleEnabled(id: string): Promise<Pipeline> {
    const pipeline = await this.findById(id);
    const updated = await this.pipelineRepository.update(id, { enabled: !pipeline.enabled });
    this.logger.log(`Pipeline ${id} enabled toggled to ${updated.enabled}`);
    return updated;
  }

  async getRunCount(pipelineId: string): Promise<number> {
    return this.pipelineRepository.countRuns(pipelineId);
  }
}
