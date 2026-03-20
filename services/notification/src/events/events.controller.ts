import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SenderService } from '../sender/sender.service';

@ApiTags('events (internal)')
@Controller('api/v1/events')
@Public()
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly senderService: SenderService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive an event from another service (internal, no auth)' })
  async receiveEvent(
    @Body() body: { orgId: string; event: string; data: Record<string, unknown> },
  ) {
    this.logger.log(`Received event "${body.event}" for org ${body.orgId}`);

    await this.senderService.processEvent({
      orgId: body.orgId,
      event: body.event,
      data: body.data,
    });

    return { received: true };
  }
}
