import { Module } from '@nestjs/common';
import { ChecklistController } from './checklist.controller';
import { ChecklistRunController, ChecklistRunReportController } from './checklist-run.controller';
import { ChecklistService } from './checklist.service';
import { ChecklistRepository } from './checklist.repository';
import { TemporalModule } from '../temporal/temporal.module';

@Module({
  imports: [TemporalModule],
  controllers: [ChecklistController, ChecklistRunController, ChecklistRunReportController],
  providers: [ChecklistService, ChecklistRepository],
  exports: [ChecklistService],
})
export class ChecklistModule {}
