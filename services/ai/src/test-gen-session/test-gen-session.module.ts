import { Module } from '@nestjs/common';
import { TestGenSessionController } from './test-gen-session.controller';
import { TestGenSessionService } from './test-gen-session.service';
import { TestGenSessionRepository } from './test-gen-session.repository';
import { ProjectProfileRepository } from './project-profile.repository';
import { AgentsModule } from '../agents/agents.module';
import { GitAdapterModule } from '../git-adapter';

@Module({
  imports: [AgentsModule, GitAdapterModule],
  controllers: [TestGenSessionController],
  providers: [
    TestGenSessionService,
    TestGenSessionRepository,
    ProjectProfileRepository,
  ],
  exports: [TestGenSessionService],
})
export class TestGenSessionModule {}
