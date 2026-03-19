import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { GenerationRepository } from './generation.repository';
import { BugDetectContextService } from './bug-detect-context.service';
import { AgentsModule } from '../agents/agents.module';
import { GitAdapterModule } from '../git-adapter';

@Module({
  imports: [AgentsModule, GitAdapterModule],
  controllers: [GenerationController],
  providers: [GenerationService, GenerationRepository, BugDetectContextService],
  exports: [GenerationService, GenerationRepository],
})
export class GenerationModule {}
