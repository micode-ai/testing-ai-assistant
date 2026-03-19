import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChecklistRepository } from './checklist.repository';
import { TemporalService } from '../temporal/temporal.service';
import { CreateChecklistDto, CreateChecklistItemDto } from './dto/create-checklist.dto';
import { UpdateChecklistDto, UpdateChecklistItemDto } from './dto/update-checklist.dto';
import { ChecklistExportDto } from './dto/checklist-response.dto';

@Injectable()
export class ChecklistService {
  private readonly logger = new Logger(ChecklistService.name);

  constructor(
    private readonly repo: ChecklistRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly temporalService: TemporalService,
  ) {}

  // --- Checklists ---

  async create(dto: CreateChecklistDto) {
    const checklist = await this.repo.create({
      projectId: dto.projectId,
      name: dto.name,
      description: dto.description ?? '',
      targetUrl: dto.targetUrl ?? null,
    });

    if (dto.items?.length) {
      for (let i = 0; i < dto.items.length; i++) {
        await this.repo.createItem({
          checklistId: checklist.id,
          title: dto.items[i].title,
          description: dto.items[i].description ?? '',
          expectedBehavior: dto.items[i].expectedBehavior ?? '',
          priority: (dto.items[i].priority as any) ?? 'MEDIUM',
          order: dto.items[i].order ?? i,
          generatedTestCode: dto.items[i].generatedTestCode ?? null,
          section: dto.items[i].section ?? '',
        });
      }
    }

    this.logger.log(`Checklist created: ${checklist.id}`);
    return this.repo.findById(checklist.id);
  }

  async findById(id: string) {
    const checklist = await this.repo.findById(id);
    if (!checklist) throw new NotFoundException('Checklist not found');
    return checklist;
  }

  async findByProject(projectId: string) {
    return this.repo.findByProject(projectId);
  }

  async update(id: string, dto: UpdateChecklistDto) {
    await this.findById(id);
    return this.repo.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.repo.delete(id);
  }

  // --- Items ---

  async addItem(checklistId: string, dto: CreateChecklistItemDto) {
    await this.findById(checklistId);
    const count = await this.repo.getItemCount(checklistId);
    return this.repo.createItem({
      checklistId,
      title: dto.title,
      description: dto.description ?? '',
      expectedBehavior: dto.expectedBehavior ?? '',
      priority: (dto.priority as any) ?? 'MEDIUM',
      order: dto.order ?? count,
      generatedTestCode: dto.generatedTestCode ?? null,
      section: dto.section ?? '',
    });
  }

  async updateItem(itemId: string, dto: UpdateChecklistItemDto) {
    const item = await this.repo.findItemById(itemId);
    if (!item) throw new NotFoundException('Checklist item not found');
    const data: any = { ...dto };
    if (dto.note !== undefined) {
      data.noteUpdatedAt = new Date();
    }
    return this.repo.updateItem(itemId, data);
  }

  async deleteItem(itemId: string) {
    const item = await this.repo.findItemById(itemId);
    if (!item) throw new NotFoundException('Checklist item not found');
    await this.repo.deleteItem(itemId);
  }

  async reorderItems(checklistId: string, itemIds: string[]) {
    await this.findById(checklistId);
    return this.repo.reorderItems(checklistId, itemIds);
  }

  // --- Import/Export ---

  async exportChecklist(id: string): Promise<ChecklistExportDto> {
    const checklist = await this.findById(id);
    return {
      version: '1.0',
      name: checklist.name,
      description: checklist.description,
      targetUrl: checklist.targetUrl,
      items: checklist.items.map((item) => ({
        title: item.title,
        description: item.description,
        expectedBehavior: item.expectedBehavior,
        priority: item.priority,
        generatedTestCode: item.generatedTestCode,
        section: item.section,
      })),
    };
  }

  async importChecklist(projectId: string, data: ChecklistExportDto) {
    return this.create({
      projectId,
      name: data.name,
      description: data.description,
      targetUrl: data.targetUrl ?? undefined,
      items: data.items.map((item, i) => ({
        title: item.title,
        description: item.description,
        expectedBehavior: item.expectedBehavior,
        priority: item.priority,
        order: i,
        generatedTestCode: item.generatedTestCode ?? undefined,
        section: item.section ?? '',
      })),
    });
  }

  // --- Item Messages ---

  async getItemMessages(itemId: string) {
    return this.repo.getItemMessages(itemId);
  }

  async sendItemMessage(checklistId: string, itemId: string, content: string, projectId?: string) {
    // Save user message
    await this.repo.createItemMessage({ itemId, role: 'user', content });

    // Load item context
    const item = await this.repo.findItemById(itemId);
    if (!item) throw new NotFoundException('Checklist item not found');

    // Load conversation history (last 10)
    const messages = await this.repo.getItemMessages(itemId);
    const history = messages.slice(-10);

    // Call AI service
    let assistantContent = 'AI service unavailable';
    try {
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:3005';
      const res = await fetch(`${aiUrl}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId || item.checklist?.projectId || '',
          type: 'CHECKLIST_ITEM_CHAT',
          inputContext: {
            item: { title: item.title, description: item.description, expectedBehavior: item.expectedBehavior },
            note: item.note || '',
            messages: history.map(m => ({ role: m.role, content: m.content })),
          },
        }),
      });
      if (res.ok) {
        const data = await res.json() as { output?: string };
        assistantContent = data.output || 'No response';
      }
    } catch {
      // Best-effort
    }

    // Save assistant message
    const assistantMsg = await this.repo.createItemMessage({ itemId, role: 'assistant', content: assistantContent });
    return assistantMsg;
  }

  // --- Runs ---

  async triggerRun(checklistId: string, targetUrl: string, triggeredBy?: string) {
    const checklist = await this.findById(checklistId);

    const run = await this.repo.createRun({
      checklistId,
      targetUrl,
      triggeredBy: triggeredBy ?? null,
      status: 'QUEUED',
    });

    // Prepare items for workflow
    const items = checklist.items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      expectedBehavior: item.expectedBehavior,
      testCode: item.generatedTestCode ?? null,
    }));

    // Start Temporal workflow asynchronously
    setImmediate(() => {
      this.temporalService.startChecklistRun({
        runId: run.id,
        checklistId,
        targetUrl,
        items,
      }).catch((err) => {
        this.logger.error(`Failed to start checklist workflow for run ${run.id}: ${err.message}`);
        this.repo.updateRunStatus(run.id, 'ERRORED', { finishedAt: new Date() }).catch(() => {});
      });
    });

    this.logger.log(`Checklist run created: ${run.id}`);
    return run;
  }

  async findRunById(runId: string) {
    const run = await this.repo.findRunById(runId);
    if (!run) throw new NotFoundException('Checklist run not found');
    return run;
  }

  async findRunsByChecklist(checklistId: string) {
    return this.repo.findRunsByChecklist(checklistId);
  }

  async startRun(runId: string) {
    return this.repo.updateRunStatus(runId, 'RUNNING', { startedAt: new Date() });
  }

  async completeRun(runId: string) {
    const run = await this.findRunById(runId);
    const hasFailed = run.itemResults.some(
      (r) => r.status === 'FAILED' || r.status === 'CANCELLED',
    );
    const status = hasFailed ? 'FAILED' : 'PASSED';
    return this.repo.updateRunStatus(runId, status, { finishedAt: new Date() });
  }

  async errorRun(runId: string) {
    return this.repo.updateRunStatus(runId, 'ERRORED', { finishedAt: new Date() });
  }

  async reportItemResult(runId: string, itemId: string, data: {
    status: string;
    summary: string;
    details?: Record<string, unknown>;
    screenshots?: string[];
    durationMs?: number;
  }) {
    const existing = await this.repo.findItemResultByRunAndItem(runId, itemId);

    if (existing) {
      return this.repo.updateItemResult(existing.id, {
        status: data.status as any,
        summary: data.summary,
        details: data.details ?? {},
        screenshots: data.screenshots ?? [],
        durationMs: data.durationMs ?? 0,
      } as any);
    }

    return this.repo.createItemResult({
      runId,
      itemId,
      status: data.status as any,
      summary: data.summary,
      details: (data.details ?? {}) as any,
      screenshots: (data.screenshots ?? []) as any,
      durationMs: data.durationMs ?? 0,
    });
  }
}
