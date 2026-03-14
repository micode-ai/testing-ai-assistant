import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';

@Injectable()
export class ChecklistRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ChecklistUncheckedCreateInput) {
    return this.prisma.checklist.create({ data });
  }

  async findById(id: string) {
    return this.prisma.checklist.findUnique({
      where: { id },
      include: { items: { orderBy: { order: 'asc' } } },
    });
  }

  async findByProject(projectId: string) {
    return this.prisma.checklist.findMany({
      where: { projectId },
      include: { items: { orderBy: { order: 'asc' } }, _count: { select: { runs: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async update(id: string, data: Prisma.ChecklistUpdateInput) {
    return this.prisma.checklist.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.checklist.delete({ where: { id } });
  }

  // --- Items ---

  async createItem(data: Prisma.ChecklistItemUncheckedCreateInput) {
    return this.prisma.checklistItem.create({ data });
  }

  async findItemById(id: string) {
    return this.prisma.checklistItem.findUnique({ where: { id } });
  }

  async updateItem(id: string, data: Prisma.ChecklistItemUpdateInput) {
    return this.prisma.checklistItem.update({ where: { id }, data });
  }

  async deleteItem(id: string) {
    return this.prisma.checklistItem.delete({ where: { id } });
  }

  async reorderItems(checklistId: string, itemIds: string[]) {
    const updates = itemIds.map((id, index) =>
      this.prisma.checklistItem.update({ where: { id }, data: { order: index } }),
    );
    return this.prisma.$transaction(updates);
  }

  async getItemCount(checklistId: string): Promise<number> {
    return this.prisma.checklistItem.count({ where: { checklistId } });
  }

  // --- Runs ---

  async createRun(data: Prisma.ChecklistRunUncheckedCreateInput) {
    return this.prisma.checklistRun.create({ data });
  }

  async findRunById(id: string) {
    return this.prisma.checklistRun.findUnique({
      where: { id },
      include: {
        itemResults: {
          include: { item: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findRunsByChecklist(checklistId: string) {
    return this.prisma.checklistRun.findMany({
      where: { checklistId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async updateRunStatus(id: string, status: string, extra?: { startedAt?: Date; finishedAt?: Date }) {
    return this.prisma.checklistRun.update({
      where: { id },
      data: { status: status as any, ...extra },
    });
  }

  // --- Item Results ---

  async createItemResult(data: Prisma.ChecklistItemResultUncheckedCreateInput) {
    return this.prisma.checklistItemResult.create({ data });
  }

  async updateItemResult(id: string, data: Prisma.ChecklistItemResultUpdateInput) {
    return this.prisma.checklistItemResult.update({ where: { id }, data });
  }

  async findItemResultByRunAndItem(runId: string, itemId: string) {
    return this.prisma.checklistItemResult.findFirst({
      where: { runId, itemId },
    });
  }
}
