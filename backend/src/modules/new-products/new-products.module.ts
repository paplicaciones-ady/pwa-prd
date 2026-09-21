import { Module } from '@nestjs/common';
import { NewProductsController } from './new-products.controller';

@Module({ controllers: [NewProductsController] })
export class NewProductsModule {}
