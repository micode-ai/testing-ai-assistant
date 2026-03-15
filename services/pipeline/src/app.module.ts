import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { TestRunModule } from './test-run/test-run.module';
import { TestResultModule } from './test-result/test-result.module';
import { SseModule } from './sse/sse.module';
import { ChecklistModule } from './checklist/checklist.module';
import { CoverageModule } from './coverage/coverage.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    PipelineModule,
    TestRunModule,
    TestResultModule,
    SseModule,
    ChecklistModule,
    CoverageModule,
  ],
  providers: [JwtStrategy],
})
export class AppModule {}
