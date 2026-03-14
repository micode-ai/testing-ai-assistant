import { Injectable } from '@nestjs/common';
import { Prisma, Project } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Project | null> {
    return this.prisma.project.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findByOrgId(orgId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByRepoUrl(orgId: string, repoUrl: string): Promise<Project | null> {
    return this.prisma.project.findFirst({
      where: { orgId, repoUrl, deletedAt: null },
    });
  }

  async hardDeleteSoftDeleted(orgId: string, repoUrl: string): Promise<void> {
    await this.prisma.project.deleteMany({
      where: { orgId, repoUrl, deletedAt: { not: null } },
    });
  }

  async findByRepoUrlGlobal(repoUrl: string): Promise<Project | null> {
    return this.prisma.project.findFirst({
      where: { repoUrl, deletedAt: null },
    });
  }

  async create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return this.prisma.project.create({ data });
  }

  async update(id: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<Project> {
    return this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
