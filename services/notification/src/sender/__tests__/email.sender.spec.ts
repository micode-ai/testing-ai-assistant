import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailSender } from '../channels/email.sender';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

import * as nodemailer from 'nodemailer';

describe('EmailSender', () => {
  let sender: EmailSender;
  let mockTransporter: { sendMail: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailSender,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const config: Record<string, unknown> = {
                SMTP_HOST: 'smtp.test.com',
                SMTP_PORT: 587,
                SMTP_USER: 'test@test.com',
                SMTP_PASS: 'password',
                DASHBOARD_URL: 'http://localhost:4200',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    sender = module.get<EmailSender>(EmailSender);
    mockTransporter = (nodemailer.createTransport as jest.Mock).mock.results[0]?.value || {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    };
  });

  it('should be defined', () => {
    expect(sender).toBeDefined();
  });

  describe('send', () => {
    it('should skip when no email recipients configured', async () => {
      await sender.send(
        { emails: [] },
        { event: 'run.finished', data: { runId: 'run-1' } },
      );

      // No error thrown, gracefully skipped
    });

    it('should skip when emails key is missing', async () => {
      await sender.send(
        {},
        { event: 'run.finished', data: { runId: 'run-1' } },
      );

      // No error thrown, gracefully skipped
    });

    it('should send email for run.finished event', async () => {
      await sender.send(
        { emails: ['admin@example.com'] },
        {
          event: 'run.finished',
          data: {
            runId: 'run-1',
            runName: 'My Test Run',
            passed: 10,
            failed: 2,
            skipped: 1,
            total: 13,
            duration: '2m 30s',
            commitSha: 'abc1234567890',
          },
        },
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com',
          subject: expect.stringContaining('Test Run Completed'),
          html: expect.stringContaining('My Test Run'),
        }),
      );
    });

    it('should send email for run.failed event', async () => {
      await sender.send(
        { emails: ['admin@example.com', 'lead@example.com'] },
        {
          event: 'run.failed',
          data: {
            runId: 'run-2',
            runName: 'Failing Run',
            errorMessage: 'Connection timeout',
            failed: 5,
            commitSha: 'def456',
          },
        },
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com, lead@example.com',
          subject: expect.stringContaining('URGENT'),
          html: expect.stringContaining('Connection timeout'),
        }),
      );
    });

    it('should send email for membership.requested event', async () => {
      await sender.send(
        { emails: ['admin@example.com'] },
        {
          event: 'membership.requested',
          data: {
            userName: 'John Doe',
            userEmail: 'john@example.com',
            orgName: 'Acme Corp',
            orgId: 'org-1',
            requestedRole: 'Developer',
          },
        },
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Membership Request'),
          html: expect.stringContaining('John Doe'),
        }),
      );
    });

    it('should send generic email for unknown events', async () => {
      await sender.send(
        { emails: ['admin@example.com'] },
        {
          event: 'custom.event',
          data: { key: 'value' },
        },
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Notification: custom.event',
        }),
      );
    });
  });
});
