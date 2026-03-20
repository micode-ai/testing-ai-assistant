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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ConfigService } from './config.service';
import { SenderService } from '../sender/sender.service';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';

@ApiTags('notification-configs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications/configs')
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    private readonly senderService: SenderService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create notification config' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateConfigDto) {
    return this.configService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notification configs by organization' })
  @ApiQuery({ name: 'orgId', required: true, type: String })
  findByOrg(@Query('orgId') orgId: string) {
    return this.configService.findByOrg(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification config by ID' })
  findById(@Param('id') id: string) {
    return this.configService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update notification config' })
  update(@Param('id') id: string, @Body() dto: UpdateConfigDto) {
    return this.configService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification config' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.configService.delete(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send a test notification for this config only' })
  async testConfig(@Param('id') id: string) {
    const config = await this.configService.findById(id);
    const payload = {
      event: config.event,
      data: {
        runId: 'test-run-000',
        runName: 'Test Notification',
        passed: 10,
        failed: 1,
        skipped: 2,
        total: 13,
        duration: '45s',
        commitSha: 'abc1234',
        branch: 'main',
      },
    };
    await this.senderService.sendToConfig(config as any, payload);
    return { success: true, message: 'Test notification sent' };
  }
}
