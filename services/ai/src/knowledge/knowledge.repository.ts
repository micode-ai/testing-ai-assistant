import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeChunk } from '../../generated/prisma';

@Injectable()
export class KnowledgeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    source: string;
    content: string;
    projectId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<KnowledgeChunk> {
    return this.prisma.knowledgeChunk.create({
      data: {
        source: data.source,
        content: data.content,
        projectId: data.projectId ?? null,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async deleteBySource(source: string): Promise<void> {
    await this.prisma.knowledgeChunk.deleteMany({
      where: { source },
    });
  }

  async deleteAll(): Promise<void> {
    await this.prisma.knowledgeChunk.deleteMany();
  }

  async findByProjectId(projectId?: string): Promise<KnowledgeChunk[]> {
    return this.prisma.knowledgeChunk.findMany({
      where: projectId ? { projectId } : { projectId: null },
    });
  }

  async count(): Promise<number> {
    return this.prisma.knowledgeChunk.count();
  }

  /**
   * Store embedding for a chunk using raw SQL (pgvector).
   */
  async updateEmbedding(id: string, embedding: number[]): Promise<void> {
    const vectorStr = `[${embedding.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      id,
    );
  }

  /**
   * Search for similar chunks using cosine distance (pgvector <=> operator).
   */
  async searchSimilar(
    queryEmbedding: number[],
    limit: number = 5,
    projectId?: string,
  ): Promise<{ id: string; source: string; content: string; metadata: unknown; distance: number }[]> {
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    if (projectId) {
      return this.prisma.$queryRawUnsafe(
        `SELECT id, source, content, metadata, embedding <=> $1::vector AS distance
         FROM knowledge_chunks
         WHERE embedding IS NOT NULL AND (project_id = $2 OR project_id IS NULL)
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        vectorStr,
        projectId,
        limit,
      );
    }

    return this.prisma.$queryRawUnsafe(
      `SELECT id, source, content, metadata, embedding <=> $1::vector AS distance
       FROM knowledge_chunks
       WHERE embedding IS NOT NULL AND project_id IS NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      vectorStr,
      limit,
    );
  }
}
