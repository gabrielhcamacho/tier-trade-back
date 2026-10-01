import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.js';
import { OutboxProcessor } from './outbox.processor.js';

@Module({
  imports: [DatabaseModule],
  providers: [OutboxProcessor],
  exports: [OutboxProcessor],
})
export class OutboxModule {}
