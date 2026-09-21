import { Module } from '@nestjs/common';
import { BrainController } from './brain.controller';

@Module({ controllers: [BrainController] })
export class BrainModule {}
