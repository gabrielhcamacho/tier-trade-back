import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabasePlatformPort } from '../database/database.js';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabasePlatformPort) {}

  @Get('live')
  live() {
    return { status: 'ok' as const };
  }

  @Get('ready')
  async ready() {
    try {
      await this.database.ping();
      return { status: 'ready' as const, database: 'ok' as const };
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready', database: 'unavailable' });
    }
  }
}
