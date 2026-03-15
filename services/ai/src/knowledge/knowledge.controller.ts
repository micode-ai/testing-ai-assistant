import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { KnowledgeService } from './knowledge.service';

@ApiTags('knowledge')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('index')
  @ApiOperation({ summary: 'Re-index documentation into knowledge base' })
  async index(): Promise<{ indexed: number }> {
    return this.knowledgeService.indexDocumentation();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search knowledge base' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'projectId', required: false })
  async search(
    @Query('q') query: string,
    @Query('projectId') projectId?: string,
  ): Promise<{ content: string; source: string; metadata: unknown }[]> {
    return this.knowledgeService.search(query, projectId);
  }
}
