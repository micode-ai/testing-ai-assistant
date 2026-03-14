import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TestResult, TestStatus, Prisma } from '../../generated/prisma';

@Injectable()
export class TestResultRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TestResult | null> {
    return this.prisma.testResult.findUnique({ where: { id } });
  }

  async findByRunId(runId: string): Promise<TestResult[]> {
    return this.prisma.testResult.findMany({
      where: { runId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByRunIdAndCheckType(runId: string, checkType: string): Promise<TestResult | null> {
    return this.prisma.testResult.findFirst({
      where: { runId, checkType: checkType as any },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.TestResultUncheckedCreateInput): Promise<TestResult> {
    return this.prisma.testResult.create({ data });
  }

  async updateStatus(
    id: string,
    status: TestStatus,
    extra?: { summary?: string; details?: unknown; durationMs?: number; artifactUrl?: string },
  ): Promise<TestResult> {
    return this.prisma.testResult.update({
      where: { id },
      data: { status, ...extra } as Prisma.TestResultUpdateInput,
    });
  }

  async update(id: string, data: Prisma.TestResultUpdateInput): Promise<TestResult> {
    return this.prisma.testResult.update({ where: { id }, data });
  }
}
