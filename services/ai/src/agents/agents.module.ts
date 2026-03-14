import { Module } from '@nestjs/common';
import { TestGeneratorService } from './test-generator/test-generator.service';
import { BugDetectorService } from './bug-detector/bug-detector.service';
import { FlakyDetectorService } from './flaky-detector/flaky-detector.service';
import { CoverageAdvisorService } from './coverage-advisor/coverage-advisor.service';

@Module({
  providers: [
    TestGeneratorService,
    BugDetectorService,
    FlakyDetectorService,
    CoverageAdvisorService,
  ],
  exports: [
    TestGeneratorService,
    BugDetectorService,
    FlakyDetectorService,
    CoverageAdvisorService,
  ],
})
export class AgentsModule {}
