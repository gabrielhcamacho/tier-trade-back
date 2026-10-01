import { Controller, Get, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DatabasePlatformPort } from '../database/database.js';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(DatabasePlatformPort) private readonly database: DatabasePlatformPort) {}

  @Get('live')
  live() {
    return { status: 'ok' as const };
  }

  @Get('ready')
  async ready() {
    try {
      await this.database.ping();
      return { status: 'ready' as const, database: 'ok' as const };
    } catch (error) {
      this.logger.error('Database readiness check failed.', error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException({ status: 'not_ready', database: 'unavailable' });
    }
  }
}
