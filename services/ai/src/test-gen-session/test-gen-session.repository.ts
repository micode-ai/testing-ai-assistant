import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TestGenSessionStatus } from '../../generated/prisma';

@Injectable()
export class TestGenSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    projectId: string;
    status: TestGenSessionStatus;
  }) {
    return this.prisma.testGenSession.create({ data });
  }

  async findById(id: string) {
    return this.prisma.testGenSession.findUnique({ where: { id } });
  }

  async findByProject(projectId: string) {
    return this.prisma.testGenSession.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async update(
    id: string,
    data: {
      status?: TestGenSessionStatus;
      profileId?: string;
      proposal?: any;
      approvedItems?: any;
      generatedTests?: any;
      metadata?: any;
      branchName?: string;
      commitSha?: string;
      commitUrl?: string;
      pullRequestUrl?: string;
      totalTokensUsed?: number;
      error?: string;
    },
  ) {
    return this.prisma.testGenSession.update({
      where: { id },
      data,
    });
  }

  async addTokens(id: string, tokens: number) {
    return this.prisma.testGenSession.update({
      where: { id },
      data: {
        totalTokensUsed: { increment: tokens },
      },
    });
  }
}
