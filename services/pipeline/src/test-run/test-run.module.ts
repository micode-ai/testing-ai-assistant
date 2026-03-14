import { Module } from '@nestjs/common';
import { TestRunController } from './test-run.controller';
import { RunReportController } from './run-report.controller';
import { TestRunService } from './test-run.service';
import { TestRunRepository } from './test-run.repository';
import { PipelineModule } from '../pipeline/pipeline.module';
import { TestResultModule } from '../test-result/test-result.module';
import { TemporalModule } from '../temporal/temporal.module';
import { ProjectClient } from '../common/clients/project.client';

@Module({
  imports: [PipelineModule, TestResultModule, TemporalModule],
  controllers: [TestRunController, RunReportController],
  providers: [TestRunService, TestRunRepository, ProjectClient],
  exports: [TestRunService, TestRunRepository],
})
export class TestRunModule {}
