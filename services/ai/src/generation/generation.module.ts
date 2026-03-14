import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { GenerationRepository } from './generation.repository';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  controllers: [GenerationController],
  providers: [GenerationService, GenerationRepository],
  exports: [GenerationService, GenerationRepository],
})
export class GenerationModule {}
