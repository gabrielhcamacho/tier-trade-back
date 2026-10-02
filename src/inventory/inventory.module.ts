import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryReceiptPort } from './inventory.port.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    { provide: InventoryReceiptPort, useExisting: InventoryService },
  ],
  exports: [InventoryReceiptPort],
})
export class InventoryModule {}
