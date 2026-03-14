import { Test, TestingModule } from '@nestjs/testing';
import { SenderService } from '../sender.service';
import { ConfigService } from '../../config/config.service';
import { LogService } from '../../log/log.service';
import { EmailSender } from '../channels/email.sender';
import { SlackSender } from '../channels/slack.sender';
import { TelegramSender } from '../channels/telegram.sender';
import { PushSender } from '../channels/push.sender';
import { NotificationChannel, NotificationStatus } from '../../../generated/prisma';

describe('SenderService', () => {
  let service: SenderService;
  let configService: jest.Mocked<ConfigService>;
  let logService: jest.Mocked<LogService>;
  let emailSender: jest.Mocked<EmailSender>;
  let slackSender: jest.Mocked<SlackSender>;
  let telegramSender: jest.Mocked<TelegramSender>;
  let pushSender: jest.Mocked<PushSender>;

  const mockEmailConfig = {
    id: 'config-email',
    orgId: 'org-1',
    channel: NotificationChannel.EMAIL,
    event: 'run.finished',
    config: { emails: ['admin@example.com'] },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSlackConfig = {
    id: 'config-slack',
    orgId: 'org-1',
    channel: NotificationChannel.SLACK,
    event: 'run.finished',
    config: { slackChannel: '#ci-results' },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLogEntry = {
    id: 'log-1',
    configId: 'config-email',
    payload: {},
    status: NotificationStatus.PENDING,
    error: null,
    sentAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SenderService,
        {
          provide: ConfigService,
          useValue: {
            findConfigsForEvent: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: {
            logNotification: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: EmailSender,
          useValue: { send: jest.fn() },
        },
        {
          provide: SlackSender,
          useValue: { send: jest.fn() },
        },
        {
          provide: TelegramSender,
          useValue: { send: jest.fn() },
        },
        {
          provide: PushSender,
          useValue: { send: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SenderService>(SenderService);
    configService = module.get(ConfigService);
    logService = module.get(LogService);
    emailSender = module.get(EmailSender);
    slackSender = module.get(SlackSender);
    telegramSender = module.get(TelegramSender);
    pushSender = module.get(PushSender);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processEvent', () => {
    it('should do nothing when no configs match', async () => {
      configService.findConfigsForEvent.mockResolvedValue([]);

      await service.processEvent({
        orgId: 'org-1',
        event: 'run.finished',
        data: { runId: 'run-1' },
      });

      expect(emailSender.send).not.toHaveBeenCalled();
      expect(slackSender.send).not.toHaveBeenCalled();
    });

    it('should dispatch to email sender when email config exists', async () => {
      configService.findConfigsForEvent.mockResolvedValue([mockEmailConfig]);
      logService.logNotification.mockResolvedValue(mockLogEntry);
      emailSender.send.mockResolvedValue(undefined);
      logService.updateStatus.mockResolvedValue({ ...mockLogEntry, status: NotificationStatus.SENT });

      await service.processEvent({
        orgId: 'org-1',
        event: 'run.finished',
        data: { runId: 'run-1', passed: 10, failed: 0 },
      });

      expect(emailSender.send).toHaveBeenCalledWith(
        { emails: ['admin@example.com'] },
        { event: 'run.finished', data: { runId: 'run-1', passed: 10, failed: 0 } },
      );
      expect(logService.updateStatus).toHaveBeenCalledWith('log-1', 'SENT');
    });

    it('should dispatch to multiple channels', async () => {
      configService.findConfigsForEvent.mockResolvedValue([mockEmailConfig, mockSlackConfig]);
      logService.logNotification.mockResolvedValue(mockLogEntry);
      emailSender.send.mockResolvedValue(undefined);
      slackSender.send.mockResolvedValue(undefined);
      logService.updateStatus.mockResolvedValue({ ...mockLogEntry, status: NotificationStatus.SENT });

      await service.processEvent({
        orgId: 'org-1',
        event: 'run.finished',
        data: { runId: 'run-1' },
      });

      expect(emailSender.send).toHaveBeenCalled();
      expect(slackSender.send).toHaveBeenCalled();
    });

    it('should log failure when a channel sender throws', async () => {
      configService.findConfigsForEvent.mockResolvedValue([mockEmailConfig]);
      logService.logNotification.mockResolvedValue(mockLogEntry);
      emailSender.send.mockRejectedValue(new Error('SMTP connection failed'));
      logService.updateStatus.mockResolvedValue({ ...mockLogEntry, status: NotificationStatus.FAILED });

      await service.processEvent({
        orgId: 'org-1',
        event: 'run.finished',
        data: { runId: 'run-1' },
      });

      expect(logService.updateStatus).toHaveBeenCalledWith('log-1', 'FAILED', 'SMTP connection failed');
    });
  });
});
