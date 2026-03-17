import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProjectId(projectId: string) {
    return this.prisma.projectProfile.findUnique({
      where: { projectId },
    });
  }

  async findById(id: string) {
    return this.prisma.projectProfile.findUnique({
      where: { id },
    });
  }

  async upsert(
    projectId: string,
    data: {
      language: string;
      testFramework: string;
      packageManager: string | null;
      structure: any;
      testPatterns: any;
      dependencies: any;
    },
  ) {
    return this.prisma.projectProfile.upsert({
      where: { projectId },
      create: {
        projectId,
        ...data,
        analyzedAt: new Date(),
      },
      update: {
        ...data,
        analyzedAt: new Date(),
      },
    });
  }
}
