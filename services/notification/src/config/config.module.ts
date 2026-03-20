import { Module, forwardRef } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';
import { ConfigRepository } from './config.repository';
import { SenderModule } from '../sender/sender.module';

@Module({
  imports: [forwardRef(() => SenderModule)],
  controllers: [ConfigController],
  providers: [ConfigService, ConfigRepository],
  exports: [ConfigService],
})
export class ConfigModule {}
