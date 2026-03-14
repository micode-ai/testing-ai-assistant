import { Module } from '@nestjs/common';
import { TestGeneratorService } from './test-generator/test-generator.service';
import { BugDetectorService } from './bug-detector/bug-detector.service';
import { FlakyDetectorService } from './flaky-detector/flaky-detector.service';
import { CoverageAdvisorService } from './coverage-advisor/coverage-advisor.service';
import { ChecklistGeneratorService } from './checklist-generator/checklist-generator.service';
import { ChecklistTestGeneratorService } from './checklist-test-generator/checklist-test-generator.service';

@Module({
  providers: [
    TestGeneratorService,
    BugDetectorService,
    FlakyDetectorService,
    CoverageAdvisorService,
    ChecklistGeneratorService,
    ChecklistTestGeneratorService,
  ],
  exports: [
    TestGeneratorService,
    BugDetectorService,
    FlakyDetectorService,
    CoverageAdvisorService,
    ChecklistGeneratorService,
    ChecklistTestGeneratorService,
  ],
})
export class AgentsModule {}
