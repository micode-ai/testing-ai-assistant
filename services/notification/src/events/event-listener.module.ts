import { Module } from '@nestjs/common';
import { EventListenerService } from './event-listener.service';
import { EventsController } from './events.controller';
import { SenderModule } from '../sender/sender.module';

@Module({
  imports: [SenderModule],
  controllers: [EventsController],
  providers: [EventListenerService],
})
export class EventListenerModule {}
