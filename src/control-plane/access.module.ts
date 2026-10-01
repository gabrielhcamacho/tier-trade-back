import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.js';
import { AccessController } from './access.controller.js';
import { AccessService } from './access.service.js';
import { IdentityProvisioningPort, SupabaseAdminClient } from './supabase-admin.client.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [AccessController],
  providers: [
    AccessService,
    SupabaseAdminClient,
    { provide: IdentityProvisioningPort, useExisting: SupabaseAdminClient },
  ],
  exports: [IdentityProvisioningPort],
})
export class AccessModule {}
