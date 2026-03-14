import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.DASHBOARD_URL || 'http://localhost:4200',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Identity Service')
    .setDescription('Authentication and user management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  await listenWithRetry(app, port, logger);
  logger.log(`Identity Service running on port ${port}`);
}

async function listenWithRetry(app: ReturnType<typeof NestFactory.create> extends Promise<infer T> ? T : never, port: string | number, logger: Logger, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      await app.listen(port);
      return;
    } catch (err: any) {
      if (err.code === 'EADDRINUSE' && i < retries - 1) {
        logger.warn(`Port ${port} in use, retrying in ${i + 1}s...`);
        await new Promise((r) => setTimeout(r, (i + 1) * 1000));
      } else {
        throw err;
      }
    }
  }
}

bootstrap();
