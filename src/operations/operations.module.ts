import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.js';
import { OperationsController } from './operations.controller.js';
import { OperationsService } from './operations.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
