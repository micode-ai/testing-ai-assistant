import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectInternalController } from './project-internal.controller';
import { ProjectService } from './project.service';
import { ProjectRepository } from './project.repository';

@Module({
  controllers: [ProjectController, ProjectInternalController],
  providers: [ProjectService, ProjectRepository],
  exports: [ProjectService, ProjectRepository],
})
export class ProjectModule {}
