import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { parseApiEnvironment } from './config/runtime-environment.js';
import { createCorsOptions } from './http/cors.js';

async function bootstrap() {
  const environment = parseApiEnvironment(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: true }));
  await app.register(helmet);
  app.enableCors(createCorsOptions(environment.WEB_ORIGIN));
  const config = new DocumentBuilder().setTitle('Tier Trade API').setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }).build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  app.enableShutdownHooks();
  await app.listen(environment.PORT, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap error';
  console.error(JSON.stringify({ event: 'api.bootstrap.failed', error: message }));
  process.exitCode = 1;
});
