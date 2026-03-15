import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TestRun, TestRunStatus, Prisma } from '../../generated/prisma';

@Injectable()
export class TestRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TestRun | null> {
    return this.prisma.testRun.findUnique({ where: { id } });
  }

  async findByIdWithResults(id: string) {
    return this.prisma.testRun.findUnique({
      where: { id },
      include: { results: true },
    });
  }

  async findByPipelineId(pipelineId: string): Promise<TestRun[]> {
    return this.prisma.testRun.findMany({
      where: { pipelineId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRecent(limit = 50): Promise<TestRun[]> {
    return this.prisma.testRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async create(data: Prisma.TestRunUncheckedCreateInput): Promise<TestRun> {
    return this.prisma.testRun.create({ data });
  }

  async updateStatus(
    id: string,
    status: TestRunStatus,
    extra?: { startedAt?: Date; finishedAt?: Date },
  ): Promise<TestRun> {
    return this.prisma.testRun.update({
      where: { id },
      data: { status, ...extra },
    });
  }

  async update(id: string, data: Prisma.TestRunUpdateInput): Promise<TestRun> {
    return this.prisma.testRun.update({ where: { id }, data });
  }
}
