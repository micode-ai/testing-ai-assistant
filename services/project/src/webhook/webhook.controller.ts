import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post(':provider')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive webhook from a git provider' })
  @ApiParam({
    name: 'provider',
    enum: ['github', 'gitlab', 'bitbucket'],
    description: 'Git provider name',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload or signature' })
  @ApiResponse({ status: 404, description: 'No project found for repository' })
  async receiveWebhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, unknown>,
  ): Promise<{ status: string }> {
    this.logger.log(`Received webhook from provider: ${provider}`);

    await this.webhookService.handleWebhook(provider, headers, body);

    return { status: 'ok' };
  }
}
