import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TestRunService } from './test-run.service';
import { CreateTestRunDto } from './dto/create-test-run.dto';
import { TestRunResponseDto } from './dto/test-run-response.dto';

@ApiTags('test-runs')
@ApiBearerAuth()
@Controller('test-runs')
@UseGuards(JwtAuthGuard)
export class TestRunController {
  constructor(private readonly testRunService: TestRunService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new test run (trigger a run)' })
  @ApiResponse({ status: 201, type: TestRunResponseDto })
  async create(@Body() dto: CreateTestRunDto): Promise<TestRunResponseDto> {
    const run = await this.testRunService.create(dto);
    return TestRunResponseDto.fromEntity(run);
  }

  @Get()
  @ApiOperation({ summary: 'List test runs by pipeline' })
  @ApiResponse({ status: 200, type: [TestRunResponseDto] })
  @ApiQuery({ name: 'pipelineId', required: true })
  async findAll(@Query('pipelineId') pipelineId: string): Promise<TestRunResponseDto[]> {
    const runs = await this.testRunService.findByPipeline(pipelineId);
    return runs.map((r) => TestRunResponseDto.fromEntity(r));
  }

  @Get('recent')
  @ApiOperation({ summary: 'List recent test runs across all pipelines' })
  @ApiResponse({ status: 200, type: [TestRunResponseDto] })
  async findRecent(): Promise<TestRunResponseDto[]> {
    const runs = await this.testRunService.findRecent();
    return runs.map((r) => TestRunResponseDto.fromEntity(r));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get test run by ID with results' })
  @ApiResponse({ status: 200, type: TestRunResponseDto })
  @ApiResponse({ status: 404, description: 'Test run not found' })
  async findOne(@Param('id') id: string): Promise<TestRunResponseDto> {
    const run = await this.testRunService.findByIdWithResults(id);
    return TestRunResponseDto.fromEntity(run);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a test run' })
  @ApiResponse({ status: 200, type: TestRunResponseDto })
  async cancel(@Param('id') id: string): Promise<TestRunResponseDto> {
    const run = await this.testRunService.cancel(id);
    return TestRunResponseDto.fromEntity(run);
  }
}
