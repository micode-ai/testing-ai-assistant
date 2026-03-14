import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ProjectService } from './project.service';
import { ProjectResponseDto } from './dto/project-response.dto';

/**
 * Internal API for inter-service communication.
 * No authentication required — intended for service-to-service calls only.
 */
@ApiTags('projects (internal)')
@Controller('api/v1/projects')
@Public()
export class ProjectInternalController {
  constructor(private readonly projectService: ProjectService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID (internal, no auth)' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findById(@Param('id') id: string): Promise<ProjectResponseDto> {
    const project = await this.projectService.findById(id);
    return ProjectResponseDto.fromEntity(project);
  }
}
