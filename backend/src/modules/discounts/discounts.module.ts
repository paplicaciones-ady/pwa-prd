import { Module } from '@nestjs/common';
import { DiscountsController } from './discounts.controller';

@Module({ controllers: [DiscountsController] })
export class DiscountsModule {}
