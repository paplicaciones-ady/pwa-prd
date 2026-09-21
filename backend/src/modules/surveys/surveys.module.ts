import { Module } from '@nestjs/common';
import { SurveysController } from './surveys.controller';

@Module({ controllers: [SurveysController] })
export class SurveysModule {}
