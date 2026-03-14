import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Pipeline, Prisma } from '../../generated/prisma';

@Injectable()
export class PipelineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Pipeline | null> {
    return this.prisma.pipeline.findUnique({ where: { id } });
  }

  async findByProjectId(projectId: string): Promise<Pipeline[]> {
    return this.prisma.pipeline.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(): Promise<Pipeline[]> {
    return this.prisma.pipeline.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(data: Prisma.PipelineCreateInput): Promise<Pipeline> {
    return this.prisma.pipeline.create({ data });
  }

  async update(id: string, data: Prisma.PipelineUpdateInput): Promise<Pipeline> {
    return this.prisma.pipeline.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Pipeline> {
    return this.prisma.pipeline.delete({ where: { id } });
  }

  async countRuns(pipelineId: string): Promise<number> {
    return this.prisma.testRun.count({ where: { pipelineId } });
  }

  async findEnabledScheduled(): Promise<Pipeline[]> {
    return this.prisma.pipeline.findMany({
      where: { enabled: true, trigger: 'SCHEDULE', cronExpr: { not: null } },
    });
  }
}
