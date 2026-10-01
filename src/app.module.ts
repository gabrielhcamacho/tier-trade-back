import { Module } from '@nestjs/common';
import { CommercialModule } from './commercial/commercial.module.js';

@Module({ imports: [CommercialModule] })
export class AppModule {}
