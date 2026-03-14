import { Module } from '@nestjs/common';
import { TestResultService } from './test-result.service';
import { TestResultRepository } from './test-result.repository';

@Module({
  providers: [TestResultService, TestResultRepository],
  exports: [TestResultService, TestResultRepository],
})
export class TestResultModule {}
