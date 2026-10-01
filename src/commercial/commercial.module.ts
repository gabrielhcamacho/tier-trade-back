import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.js';
import { DevelopmentIdentityGuard } from '../common/identity.guard.js';
import { CommercialController } from './commercial.controller.js';
import { CommercialService } from './commercial.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CommercialController],
  providers: [CommercialService, DevelopmentIdentityGuard],
})
export class CommercialModule {}
