import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChecklistService } from './checklist.service';
import { CreateChecklistDto, CreateChecklistItemDto } from './dto/create-checklist.dto';
import { UpdateChecklistDto, UpdateChecklistItemDto } from './dto/update-checklist.dto';
import { ChecklistExportDto, ChecklistResponseDto } from './dto/checklist-response.dto';

@ApiTags('checklists')
@ApiBearerAuth()
@Controller('checklists')
@UseGuards(JwtAuthGuard)
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new checklist' })
  @ApiResponse({ status: 201 })
  async create(@Body() dto: CreateChecklistDto) {
    return this.checklistService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List checklists by project' })
  @ApiQuery({ name: 'projectId', required: true })
  async findByProject(@Query('projectId') projectId: string) {
    return this.checklistService.findByProject(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get checklist with items' })
  async findById(@Param('id') id: string) {
    return this.checklistService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update checklist' })
  async update(@Param('id') id: string, @Body() dto: UpdateChecklistDto) {
    return this.checklistService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete checklist' })
  async delete(@Param('id') id: string) {
    await this.checklistService.delete(id);
  }

  // --- Items ---

  @Post(':id/items')
  @ApiOperation({ summary: 'Add item to checklist' })
  async addItem(@Param('id') id: string, @Body() dto: CreateChecklistItemDto) {
    return this.checklistService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Update checklist item' })
  async updateItem(@Param('itemId') itemId: string, @Body() dto: UpdateChecklistItemDto) {
    return this.checklistService.updateItem(itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete checklist item' })
  async deleteItem(@Param('itemId') itemId: string) {
    await this.checklistService.deleteItem(itemId);
  }

  @Post(':id/items/reorder')
  @ApiOperation({ summary: 'Reorder checklist items' })
  async reorderItems(@Param('id') id: string, @Body() body: { itemIds: string[] }) {
    return this.checklistService.reorderItems(id, body.itemIds);
  }

  // --- Import/Export ---

  @Post(':id/export')
  @ApiOperation({ summary: 'Export checklist as JSON' })
  async exportChecklist(@Param('id') id: string) {
    return this.checklistService.exportChecklist(id);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import checklist from JSON' })
  async importChecklist(@Body() body: { projectId: string; data: ChecklistExportDto }) {
    return this.checklistService.importChecklist(body.projectId, body.data);
  }

  // --- Runs ---

  @Post(':id/run')
  @ApiOperation({ summary: 'Trigger checklist execution' })
  async triggerRun(@Param('id') id: string, @Body() body: { targetUrl: string; triggeredBy?: string }) {
    return this.checklistService.triggerRun(id, body.targetUrl, body.triggeredBy);
  }
}
