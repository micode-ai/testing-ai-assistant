import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { GenerationType } from '../../generated/prisma';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GenerationService } from './generation.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { GenerationResponseDto, GenerationStatsDto } from './dto/generation-response.dto';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Trigger an AI generation' })
  @ApiResponse({ status: 201, description: 'Generation completed', type: GenerationResponseDto })
  @ApiResponse({ status: 400, description: 'Generation failed' })
  async generate(
    @Body() dto: CreateGenerationDto,
  ): Promise<GenerationResponseDto> {
    const generation = await this.generationService.create(dto);
    return GenerationResponseDto.fromEntity(generation);
  }

  @Get('generations')
  @ApiOperation({ summary: 'List generations for a project' })
  @ApiQuery({ name: 'projectId', required: true, description: 'Project ID' })
  @ApiQuery({ name: 'type', required: false, enum: GenerationType, description: 'Filter by generation type' })
  @ApiResponse({ status: 200, description: 'List of generations', type: [GenerationResponseDto] })
  async findByProject(
    @Query('projectId') projectId: string,
    @Query('type') type?: GenerationType,
  ): Promise<GenerationResponseDto[]> {
    const generations = await this.generationService.findByProject(projectId, type);
    return generations.map(GenerationResponseDto.fromEntity);
  }

  @Get('generations/stats')
  @ApiOperation({ summary: 'Get generation statistics for a project' })
  @ApiQuery({ name: 'projectId', required: true, description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Generation statistics', type: GenerationStatsDto })
  async getStats(
    @Query('projectId') projectId: string,
  ): Promise<GenerationStatsDto> {
    return this.generationService.getStats(projectId);
  }

  @Get('generations/:id')
  @ApiOperation({ summary: 'Get generation details' })
  @ApiResponse({ status: 200, description: 'Generation details', type: GenerationResponseDto })
  @ApiResponse({ status: 404, description: 'Generation not found' })
  async findById(@Param('id') id: string): Promise<GenerationResponseDto> {
    const generation = await this.generationService.findById(id);
    return GenerationResponseDto.fromEntity(generation);
  }

  @Patch('generations/:id/feedback')
  @ApiOperation({ summary: 'Accept or reject a generation with feedback' })
  @ApiResponse({ status: 200, description: 'Feedback updated', type: GenerationResponseDto })
  @ApiResponse({ status: 404, description: 'Generation not found' })
  async updateFeedback(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
  ): Promise<GenerationResponseDto> {
    const generation = await this.generationService.updateFeedback(id, dto);
    return GenerationResponseDto.fromEntity(generation);
  }
}
