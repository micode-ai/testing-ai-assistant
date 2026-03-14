import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';

@Injectable()
export class SlackSender {
  private readonly logger = new Logger(SlackSender.name);
  private client: WebClient;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('SLACK_BOT_TOKEN');
    this.client = new WebClient(token);
  }

  async send(channelConfig: Record<string, unknown>, payload: Record<string, unknown>): Promise<void> {
    const slackChannel = channelConfig.slackChannel as string;
    if (!slackChannel) {
      this.logger.warn('No Slack channel configured, skipping');
      return;
    }

    const event = payload.event as string;
    const data = payload.data as Record<string, unknown>;
    const blocks = this.buildBlocks(event, data);

    await this.client.chat.postMessage({
      channel: slackChannel,
      blocks: blocks as any,
      text: this.buildFallbackText(event, data),
    });

    this.logger.log(`Slack message sent to ${slackChannel} for event ${event}`);
  }

  private buildFallbackText(event: string, data: Record<string, unknown>): string {
    switch (event) {
      case 'run.finished':
        return `Test run ${data.runName || data.runId} completed: ${data.passed} passed, ${data.failed} failed`;
      case 'run.failed':
        return `Test run ${data.runName || data.runId} failed: ${data.errorMessage || 'Unknown error'}`;
      case 'membership.requested':
        return `${data.userName || data.userEmail} requested to join ${data.orgName || 'your organization'}`;
      default:
        return `Notification: ${event}`;
    }
  }

  private buildBlocks(event: string, data: Record<string, unknown>): Record<string, unknown>[] {
    const dashboardUrl = this.configService.get<string>('DASHBOARD_URL', 'http://localhost:4200');

    switch (event) {
      case 'run.finished':
        return this.buildRunFinishedBlocks(data, dashboardUrl);
      case 'run.failed':
        return this.buildRunFailedBlocks(data, dashboardUrl);
      case 'membership.requested':
        return this.buildMembershipRequestedBlocks(data, dashboardUrl);
      default:
        return this.buildGenericBlocks(event, data);
    }
  }

  private buildRunFinishedBlocks(data: Record<string, unknown>, dashboardUrl: string): Record<string, unknown>[] {
    const statusEmoji = (data.failed as number) > 0 ? ':warning:' : ':white_check_mark:';
    const commit = data.commitSha ? (data.commitSha as string).substring(0, 7) : 'N/A';

    return [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${statusEmoji} Test Run Completed` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Run:*\n${data.runName || data.runId || 'N/A'}` },
          { type: 'mrkdwn', text: `*Commit:*\n\`${commit}\`` },
          { type: 'mrkdwn', text: `*Passed:*\n${data.passed ?? 0}` },
          { type: 'mrkdwn', text: `*Failed:*\n${data.failed ?? 0}` },
          { type: 'mrkdwn', text: `*Skipped:*\n${data.skipped ?? 0}` },
          { type: 'mrkdwn', text: `*Duration:*\n${data.duration ?? 'N/A'}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Run Details' },
            url: `${dashboardUrl}/runs/${data.runId}`,
            style: 'primary',
          },
        ],
      },
    ];
  }

  private buildRunFailedBlocks(data: Record<string, unknown>, dashboardUrl: string): Record<string, unknown>[] {
    const commit = data.commitSha ? (data.commitSha as string).substring(0, 7) : 'N/A';

    return [
      {
        type: 'header',
        text: { type: 'plain_text', text: ':x: Test Run Failed' },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:* ${data.errorMessage || 'No error details available'}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Run:*\n${data.runName || data.runId || 'N/A'}` },
          { type: 'mrkdwn', text: `*Commit:*\n\`${commit}\`` },
          { type: 'mrkdwn', text: `*Failed Tests:*\n${data.failed ?? 0}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Run Details' },
            url: `${dashboardUrl}/runs/${data.runId}`,
            style: 'danger',
          },
        ],
      },
    ];
  }

  private buildMembershipRequestedBlocks(data: Record<string, unknown>, dashboardUrl: string): Record<string, unknown>[] {
    return [
      {
        type: 'header',
        text: { type: 'plain_text', text: ':bust_in_silhouette: New Membership Request' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*User:*\n${data.userName || 'N/A'}` },
          { type: 'mrkdwn', text: `*Email:*\n${data.userEmail || 'N/A'}` },
          { type: 'mrkdwn', text: `*Organization:*\n${data.orgName || 'N/A'}` },
          { type: 'mrkdwn', text: `*Requested Role:*\n${data.requestedRole || 'Member'}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Review Request' },
            url: `${dashboardUrl}/orgs/${data.orgId}/members`,
            style: 'primary',
          },
        ],
      },
    ];
  }

  private buildGenericBlocks(event: string, data: Record<string, unknown>): Record<string, unknown>[] {
    return [
      {
        type: 'header',
        text: { type: 'plain_text', text: `Notification: ${event}` },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`\`\`${JSON.stringify(data, null, 2)}\`\`\``,
        },
      },
    ];
  }
}
