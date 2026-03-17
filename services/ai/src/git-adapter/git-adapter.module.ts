import { Module } from '@nestjs/common';
import { GitAdapterFactory } from './git-adapter.factory';

@Module({
  providers: [GitAdapterFactory],
  exports: [GitAdapterFactory],
})
export class GitAdapterModule {}
