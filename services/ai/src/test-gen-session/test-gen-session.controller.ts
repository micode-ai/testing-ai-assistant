import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TestGenSessionService } from './test-gen-session.service';
import {
  StartSessionDto,
  GenerateProposalDto,
  ApproveProposalDto,
  UpdateTestsDto,
  CommitTestsDto,
  RegenerateTestsDto,
} from './dto/start-session.dto';

@Controller('ai/test-gen-sessions')
@UseGuards(JwtAuthGuard)
export class TestGenSessionController {
  constructor(private readonly sessionService: TestGenSessionService) {}

  @Post()
  async startSession(@Body() dto: StartSessionDto) {
    return this.sessionService.startSession(dto.projectId, dto.locale);
  }

  @Get()
  async getSessions(@Query('projectId') projectId: string) {
    return this.sessionService.getSessionsByProject(projectId);
  }

  @Get(':id')
  async getSession(@Param('id') id: string) {
    return this.sessionService.getSession(id);
  }

  @Get('profile/:projectId')
  async getProjectProfile(@Param('projectId') projectId: string) {
    return this.sessionService.getProjectProfile(projectId);
  }

  @Post(':id/propose')
  async generateProposal(
    @Param('id') id: string,
    @Body() dto: GenerateProposalDto,
  ) {
    return this.sessionService.generateProposal(id, dto.focusArea, dto.locale);
  }

  @Post(':id/approve')
  async approveProposal(
    @Param('id') id: string,
    @Body() dto: ApproveProposalDto,
  ) {
    return this.sessionService.approveProposal(id, dto.approvedItemIds);
  }

  @Post(':id/generate')
  async generateTests(@Param('id') id: string) {
    return this.sessionService.startTestGeneration(id);
  }

  @Patch(':id/tests')
  async updateTests(@Param('id') id: string, @Body() dto: UpdateTestsDto) {
    return this.sessionService.updateGeneratedTests(id, dto.tests);
  }

  /**
   * Regenerate specific tests (by proposal item IDs) within an existing session.
   */
  @Post(':id/regenerate')
  async regenerateTests(
    @Param('id') id: string,
    @Body() dto: RegenerateTestsDto,
  ) {
    return this.sessionService.startRegeneration(id, dto.itemIds);
  }

  /**
   * Skip validation and move directly to REVIEW.
   */
  @Post(':id/cancel')
  async cancelSession(@Param('id') id: string) {
    return this.sessionService.cancelSession(id);
  }

  @Post(':id/skip-validation')
  async skipValidation(@Param('id') id: string) {
    return this.sessionService.skipValidation(id);
  }

  @Post(':id/commit')
  async commitTests(@Param('id') id: string, @Body() dto: CommitTestsDto) {
    return this.sessionService.commitTests(id, {
      createPR: dto.createPR,
      commitMessage: dto.commitMessage,
    });
  }
}
