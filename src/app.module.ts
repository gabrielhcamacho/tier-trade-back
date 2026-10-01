import { Module } from '@nestjs/common';
import { CommercialModule } from './commercial/commercial.module.js';
import { HealthModule } from './health/health.module.js';

@Module({ imports: [CommercialModule, HealthModule] })
export class AppModule {}
