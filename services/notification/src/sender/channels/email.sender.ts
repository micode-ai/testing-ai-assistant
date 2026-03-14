import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface EmailPayload {
  to: string[];
  subject: string;
  event: string;
  data: Record<string, unknown>;
}

@Injectable()
export class EmailSender {
  private readonly logger = new Logger(EmailSender.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async send(channelConfig: Record<string, unknown>, payload: Record<string, unknown>): Promise<void> {
    const recipients = (channelConfig.emails as string[]) || [];
    if (recipients.length === 0) {
      this.logger.warn('No email recipients configured, skipping');
      return;
    }

    const event = payload.event as string;
    const data = payload.data as Record<string, unknown>;
    const subject = this.buildSubject(event, data);
    const html = this.buildHtml(event, data);

    const dashboardUrl = this.configService.get<string>('DASHBOARD_URL', 'http://localhost:4200');

    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_USER', 'notifications@testing-ai.com'),
      to: recipients.join(', '),
      subject,
      html,
    });

    this.logger.log(`Email sent to ${recipients.join(', ')} for event ${event}`);
  }

  private buildSubject(event: string, data: Record<string, unknown>): string {
    switch (event) {
      case 'run.finished':
        return `Test Run Completed: ${data.runName || data.runId || 'Unknown'}`;
      case 'run.failed':
        return `[URGENT] Test Run Failed: ${data.runName || data.runId || 'Unknown'}`;
      case 'membership.requested':
        return `New Membership Request from ${data.userName || data.userEmail || 'Unknown User'}`;
      default:
        return `Notification: ${event}`;
    }
  }

  private buildHtml(event: string, data: Record<string, unknown>): string {
    const dashboardUrl = this.configService.get<string>('DASHBOARD_URL', 'http://localhost:4200');

    switch (event) {
      case 'run.finished':
        return this.buildRunFinishedHtml(data, dashboardUrl);
      case 'run.failed':
        return this.buildRunFailedHtml(data, dashboardUrl);
      case 'membership.requested':
        return this.buildMembershipRequestedHtml(data, dashboardUrl);
      default:
        return this.buildGenericHtml(event, data);
    }
  }

  private buildRunFinishedHtml(data: Record<string, unknown>, dashboardUrl: string): string {
    const passed = data.passed ?? 0;
    const failed = data.failed ?? 0;
    const skipped = data.skipped ?? 0;
    const total = data.total ?? 0;
    const duration = data.duration ?? 'N/A';
    const commit = data.commitSha ? (data.commitSha as string).substring(0, 7) : 'N/A';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Test Run Completed</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Run</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.runName || data.runId || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Status</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #16a34a;">Completed</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Passed</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #16a34a;">${passed}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Failed</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #dc2626;">${failed}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Skipped</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #ca8a04;">${skipped}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Total</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${total}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Duration</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${duration}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Commit</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><code>${commit}</code></td></tr>
        </table>
        <a href="${dashboardUrl}/runs/${data.runId}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View Run Details</a>
      </div>
    `;
  }

  private buildRunFailedHtml(data: Record<string, unknown>, dashboardUrl: string): string {
    const errorMessage = data.errorMessage || 'No error details available';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Test Run Failed</h2>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #dc2626; font-weight: bold;">Error:</p>
          <p style="margin: 8px 0 0; color: #7f1d1d;">${errorMessage}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Run</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.runName || data.runId || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Failed Tests</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #dc2626;">${data.failed ?? 0}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Commit</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><code>${data.commitSha ? (data.commitSha as string).substring(0, 7) : 'N/A'}</code></td></tr>
        </table>
        <a href="${dashboardUrl}/runs/${data.runId}" style="display: inline-block; padding: 10px 20px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px;">View Run Details</a>
      </div>
    `;
  }

  private buildMembershipRequestedHtml(data: Record<string, unknown>, dashboardUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Membership Request</h2>
        <p><strong>${data.userName || data.userEmail || 'A user'}</strong> has requested to join your organization <strong>${data.orgName || 'your organization'}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">User</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.userName || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Email</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.userEmail || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Requested Role</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.requestedRole || 'Member'}</td></tr>
        </table>
        <a href="${dashboardUrl}/orgs/${data.orgId}/members" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Review Request</a>
      </div>
    `;
  }

  private buildGenericHtml(event: string, data: Record<string, unknown>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Notification: ${event}</h2>
        <pre style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>
      </div>
    `;
  }
}
