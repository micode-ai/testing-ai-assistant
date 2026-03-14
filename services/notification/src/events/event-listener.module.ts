import { Module } from '@nestjs/common';
import { EventListenerService } from './event-listener.service';
import { SenderModule } from '../sender/sender.module';

@Module({
  imports: [SenderModule],
  providers: [EventListenerService],
})
export class EventListenerModule {}
