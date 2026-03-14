import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PipelineService } from './pipeline.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { PipelineResponseDto } from './dto/pipeline-response.dto';

@ApiTags('pipelines')
@ApiBearerAuth()
@Controller('pipelines')
@UseGuards(JwtAuthGuard)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new pipeline' })
  @ApiResponse({ status: 201, type: PipelineResponseDto })
  async create(@Body() dto: CreatePipelineDto): Promise<PipelineResponseDto> {
    const pipeline = await this.pipelineService.create(dto);
    return PipelineResponseDto.fromEntity(pipeline);
  }

  @Get()
  @ApiOperation({ summary: 'List pipelines, optionally filtered by projectId' })
  @ApiResponse({ status: 200, type: [PipelineResponseDto] })
  @ApiQuery({ name: 'projectId', required: false })
  async findAll(@Query('projectId') projectId?: string): Promise<PipelineResponseDto[]> {
    const pipelines = projectId
      ? await this.pipelineService.findByProject(projectId)
      : await this.pipelineService.findAll();
    return pipelines.map((p) => PipelineResponseDto.fromEntity(p));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pipeline by ID' })
  @ApiResponse({ status: 200, type: PipelineResponseDto })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async findOne(@Param('id') id: string): Promise<PipelineResponseDto> {
    const pipeline = await this.pipelineService.findById(id);
    const runCount = await this.pipelineService.getRunCount(id);
    return PipelineResponseDto.fromEntity(pipeline, runCount);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update pipeline' })
  @ApiResponse({ status: 200, type: PipelineResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePipelineDto,
  ): Promise<PipelineResponseDto> {
    const updated = await this.pipelineService.update(id, dto);
    return PipelineResponseDto.fromEntity(updated);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete pipeline' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id') id: string): Promise<void> {
    await this.pipelineService.delete(id);
  }

  @Post(':id/toggle')
  @ApiOperation({ summary: 'Toggle pipeline enabled/disabled' })
  @ApiResponse({ status: 200, type: PipelineResponseDto })
  async toggleEnabled(@Param('id') id: string): Promise<PipelineResponseDto> {
    const updated = await this.pipelineService.toggleEnabled(id);
    return PipelineResponseDto.fromEntity(updated);
  }
}
