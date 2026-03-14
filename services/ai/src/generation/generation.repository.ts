import { Injectable } from '@nestjs/common';
import { Prisma, AIGeneration, GenerationType } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GenerationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AIGeneration | null> {
    return this.prisma.aIGeneration.findUnique({
      where: { id },
    });
  }

  async findByProjectId(
    projectId: string,
    options?: { type?: GenerationType; skip?: number; take?: number },
  ): Promise<AIGeneration[]> {
    return this.prisma.aIGeneration.findMany({
      where: {
        projectId,
        ...(options?.type && { type: options.type }),
      },
      orderBy: { createdAt: 'desc' },
      skip: options?.skip,
      take: options?.take,
    });
  }

  async findByType(type: GenerationType): Promise<AIGeneration[]> {
    return this.prisma.aIGeneration.findMany({
      where: { type },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.AIGenerationCreateInput): Promise<AIGeneration> {
    return this.prisma.aIGeneration.create({ data });
  }

  async update(id: string, data: Prisma.AIGenerationUpdateInput): Promise<AIGeneration> {
    return this.prisma.aIGeneration.update({
      where: { id },
      data,
    });
  }

  async countByProjectId(projectId: string): Promise<number> {
    return this.prisma.aIGeneration.count({
      where: { projectId },
    });
  }

  async getStatsByProjectId(projectId: string): Promise<{
    total: number;
    byType: { type: GenerationType; _count: number }[];
    accepted: number;
    rejected: number;
    pending: number;
    totalTokens: number;
  }> {
    const [total, byType, accepted, rejected, pending, tokensAgg] = await Promise.all([
      this.prisma.aIGeneration.count({ where: { projectId } }),
      this.prisma.aIGeneration.groupBy({
        by: ['type'],
        where: { projectId },
        _count: true,
      }),
      this.prisma.aIGeneration.count({ where: { projectId, accepted: true } }),
      this.prisma.aIGeneration.count({ where: { projectId, accepted: false } }),
      this.prisma.aIGeneration.count({ where: { projectId, accepted: null } }),
      this.prisma.aIGeneration.aggregate({
        where: { projectId },
        _sum: { tokensUsed: true },
      }),
    ]);

    return {
      total,
      byType: byType.map((b) => ({ type: b.type, _count: b._count })),
      accepted,
      rejected,
      pending,
      totalTokens: tokensAgg._sum.tokensUsed || 0,
    };
  }
}
