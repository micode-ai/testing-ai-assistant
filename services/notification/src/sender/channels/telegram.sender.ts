import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramSender {
  private readonly logger = new Logger(TelegramSender.name);
  private readonly botToken: string;
  private readonly apiBase = 'https://api.telegram.org';

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  async send(channelConfig: Record<string, unknown>, payload: Record<string, unknown>): Promise<void> {
    const chatId = channelConfig.chatId as string;
    if (!chatId) {
      this.logger.warn('No Telegram chat ID configured, skipping');
      return;
    }

    if (!this.botToken) {
      this.logger.warn('No Telegram bot token configured, skipping');
      return;
    }

    const event = payload.event as string;
    const data = payload.data as Record<string, unknown>;
    const message = this.buildMessage(event, data);

    const url = `${this.apiBase}/bot${this.botToken}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Telegram API error: ${response.status} - ${errorBody}`);
    }

    this.logger.log(`Telegram message sent to chat ${chatId} for event ${event}`);
  }

  private buildMessage(event: string, data: Record<string, unknown>): string {
    const dashboardUrl = this.configService.get<string>('DASHBOARD_URL', 'http://localhost:4200');

    switch (event) {
      case 'run.finished':
        return this.buildRunFinishedMessage(data, dashboardUrl);
      case 'run.failed':
        return this.buildRunFailedMessage(data, dashboardUrl);
      case 'membership.requested':
        return this.buildMembershipRequestedMessage(data, dashboardUrl);
      default:
        return this.buildGenericMessage(event, data);
    }
  }

  private buildRunFinishedMessage(data: Record<string, unknown>, dashboardUrl: string): string {
    const statusIcon = (data.failed as number) > 0 ? '⚠' : '✅';
    const commit = data.commitSha ? (data.commitSha as string).substring(0, 7) : 'N/A';

    return [
      `${statusIcon} <b>Test Run Completed</b>`,
      '',
      `<b>Run:</b> ${data.runName || data.runId || 'N/A'}`,
      `<b>Passed:</b> ${data.passed ?? 0}`,
      `<b>Failed:</b> ${data.failed ?? 0}`,
      `<b>Skipped:</b> ${data.skipped ?? 0}`,
      `<b>Total:</b> ${data.total ?? 0}`,
      `<b>Duration:</b> ${data.duration ?? 'N/A'}`,
      `<b>Commit:</b> <code>${commit}</code>`,
      '',
      `<a href="${dashboardUrl}/runs/${data.runId}">View Run Details</a>`,
    ].join('\n');
  }

  private buildRunFailedMessage(data: Record<string, unknown>, dashboardUrl: string): string {
    const commit = data.commitSha ? (data.commitSha as string).substring(0, 7) : 'N/A';

    return [
      `❌ <b>Test Run Failed</b>`,
      '',
      `<b>Run:</b> ${data.runName || data.runId || 'N/A'}`,
      `<b>Error:</b> ${data.errorMessage || 'No error details'}`,
      `<b>Failed Tests:</b> ${data.failed ?? 0}`,
      `<b>Commit:</b> <code>${commit}</code>`,
      '',
      `<a href="${dashboardUrl}/runs/${data.runId}">View Run Details</a>`,
    ].join('\n');
  }

  private buildMembershipRequestedMessage(data: Record<string, unknown>, dashboardUrl: string): string {
    return [
      `👤 <b>New Membership Request</b>`,
      '',
      `<b>User:</b> ${data.userName || 'N/A'}`,
      `<b>Email:</b> ${data.userEmail || 'N/A'}`,
      `<b>Organization:</b> ${data.orgName || 'N/A'}`,
      `<b>Requested Role:</b> ${data.requestedRole || 'Member'}`,
      '',
      `<a href="${dashboardUrl}/orgs/${data.orgId}/members">Review Request</a>`,
    ].join('\n');
  }

  private buildGenericMessage(event: string, data: Record<string, unknown>): string {
    return [
      `📢 <b>Notification: ${event}</b>`,
      '',
      `<pre>${JSON.stringify(data, null, 2)}</pre>`,
    ].join('\n');
  }
}
