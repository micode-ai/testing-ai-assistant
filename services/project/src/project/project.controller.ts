import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created', type: ProjectResponseDto })
  @ApiResponse({ status: 409, description: 'Project with this repo URL already exists' })
  async create(
    @Body() dto: CreateProjectDto,
    @CurrentUser('sub') userId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectService.create(dto);
    return ProjectResponseDto.fromEntity(project);
  }

  @Get()
  @ApiOperation({ summary: 'List projects by organization' })
  @ApiQuery({ name: 'orgId', required: true, description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'List of projects', type: [ProjectResponseDto] })
  async findByOrg(@Query('orgId') orgId: string): Promise<ProjectResponseDto[]> {
    const projects = await this.projectService.findByOrg(orgId);
    return projects.map(ProjectResponseDto.fromEntity);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiResponse({ status: 200, description: 'Project details', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findById(@Param('id') id: string): Promise<ProjectResponseDto> {
    const project = await this.projectService.findById(id);
    return ProjectResponseDto.fromEntity(project);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiResponse({ status: 200, description: 'Project updated', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectService.update(id, dto);
    return ProjectResponseDto.fromEntity(project);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a project' })
  @ApiResponse({ status: 204, description: 'Project deleted' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.projectService.delete(id);
  }

  @Post(':id/webhook/connect')
  @ApiOperation({ summary: 'Connect webhook for a project' })
  @ApiResponse({ status: 200, description: 'Webhook connected', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async connectWebhook(@Param('id') id: string): Promise<ProjectResponseDto> {
    const project = await this.projectService.connectWebhook(id);
    return ProjectResponseDto.fromEntity(project);
  }

  @Delete(':id/webhook/disconnect')
  @ApiOperation({ summary: 'Disconnect webhook for a project' })
  @ApiResponse({ status: 200, description: 'Webhook disconnected', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async disconnectWebhook(@Param('id') id: string): Promise<ProjectResponseDto> {
    const project = await this.projectService.disconnectWebhook(id);
    return ProjectResponseDto.fromEntity(project);
  }
}
