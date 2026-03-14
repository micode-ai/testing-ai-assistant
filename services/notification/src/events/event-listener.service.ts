import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SenderService } from '../sender/sender.service';

@Injectable()
export class EventListenerService {
  private readonly logger = new Logger(EventListenerService.name);

  constructor(private readonly senderService: SenderService) {}

  @OnEvent('run.finished')
  async handleRunFinished(payload: {
    orgId: string;
    runId: string;
    runName?: string;
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    duration: string;
    commitSha?: string;
    branch?: string;
  }) {
    this.logger.log(`Received run.finished event for run ${payload.runId}`);

    await this.senderService.processEvent({
      orgId: payload.orgId,
      event: 'run.finished',
      data: {
        runId: payload.runId,
        runName: payload.runName,
        passed: payload.passed,
        failed: payload.failed,
        skipped: payload.skipped,
        total: payload.total,
        duration: payload.duration,
        commitSha: payload.commitSha,
        branch: payload.branch,
      },
    });
  }

  @OnEvent('run.failed')
  async handleRunFailed(payload: {
    orgId: string;
    runId: string;
    runName?: string;
    errorMessage?: string;
    failed: number;
    commitSha?: string;
    branch?: string;
  }) {
    this.logger.log(`Received run.failed event for run ${payload.runId}`);

    await this.senderService.processEvent({
      orgId: payload.orgId,
      event: 'run.failed',
      data: {
        runId: payload.runId,
        runName: payload.runName,
        errorMessage: payload.errorMessage,
        failed: payload.failed,
        commitSha: payload.commitSha,
        branch: payload.branch,
      },
    });
  }

  @OnEvent('membership.requested')
  async handleMembershipRequested(payload: {
    orgId: string;
    orgName?: string;
    userId: string;
    userName?: string;
    userEmail: string;
    requestedRole?: string;
  }) {
    this.logger.log(`Received membership.requested event for user ${payload.userEmail} in org ${payload.orgId}`);

    await this.senderService.processEvent({
      orgId: payload.orgId,
      event: 'membership.requested',
      data: {
        orgId: payload.orgId,
        orgName: payload.orgName,
        userId: payload.userId,
        userName: payload.userName,
        userEmail: payload.userEmail,
        requestedRole: payload.requestedRole || 'Member',
      },
    });
  }
}
