import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Credit } from './entities/credit.entity';
import { CreditDocument } from './entities/credit-document.entity';
import { CreditsService } from './credits.service';
import { CreditStudyAlgorithmService } from './credit-study-algorithm.service';
import { CreditSignatureService } from './credit-signature.service';
import { CreditStudyPoller } from './credit-study.poller';
import { CreditsController } from './credits.controller';
import { ClientsModule } from '../clients/clients.module';
import { IdempotencyInterceptor } from '../../commons/interceptors/idempotency.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Credit, CreditDocument]), ClientsModule],
  controllers: [CreditsController],
  providers: [
    CreditsService,
    CreditStudyAlgorithmService,
    CreditSignatureService,
    CreditStudyPoller,
    IdempotencyInterceptor,
  ],
  exports: [CreditsService],
})
export class CreditsModule {}