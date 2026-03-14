import { Module } from '@nestjs/common';
import { SenderService } from './sender.service';
import { EmailSender } from './channels/email.sender';
import { SlackSender } from './channels/slack.sender';
import { TelegramSender } from './channels/telegram.sender';
import { PushSender } from './channels/push.sender';
import { ConfigModule } from '../config/config.module';
import { LogModule } from '../log/log.module';

@Module({
  imports: [ConfigModule, LogModule],
  providers: [SenderService, EmailSender, SlackSender, TelegramSender, PushSender],
  exports: [SenderService],
})
export class SenderModule {}
