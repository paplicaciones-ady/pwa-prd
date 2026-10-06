import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { Credit, CreditStatus } from './entities/credit.entity';
import { CreditsService } from './credits.service';

/** Borradores que se revisan por empresa en cada vuelta. */
const BATCH_SIZE = 50;

/**
 * Resuelve en segundo plano los borradores que el front dejó de consultar
 * (pasado el primer minuto). Cada CREDIT_STUDY_POLL_INTERVAL_MS recorre las
 * empresas, pide al algoritmo el veredicto de sus borradores y lo aplica.
 *
 * RLS: fuera de un request no hay TenantContextInterceptor, así que cada
 * lectura/escritura corre en una transacción con `app.current_company_id`
 * local a ella. Las llamadas al algoritmo van fuera de las transacciones
 * para no retener conexiones del pool mientras se espera la red.
 *
 * Varias instancias del backend pueden correrlo a la vez sin daño:
 * `applyDraftOutcome` solo escribe si el crédito sigue en borrador.
 */
@Injectable()
export class CreditStudyPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CreditStudyPoller.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly credits: CreditsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const interval = Number(this.config.get('CREDIT_STUDY_POLL_INTERVAL_MS') ?? 30_000);
    if (interval <= 0) return;
    this.timer = setInterval(() => void this.tick(), interval);
    // No mantiene vivo el proceso por sí solo (tests, scripts).
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    // Una vuelta lenta (algoritmo caído, timeouts) no se solapa con la siguiente.
    if (this.running) return;
    this.running = true;
    try {
      const companies: { id: string }[] = await this.dataSource.query(`SELECT id FROM companies WHERE is_active`);
      for (const { id } of companies) await this.resolveCompany(id);
    } catch (err) {
      this.logger.error(`Sondeo de estudios de crédito: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async resolveCompany(companyId: string) {
    const drafts = await this.inTenant(companyId, (m) =>
      m.find(Credit, { where: { companyId, status: CreditStatus.DRAFT }, order: { createdAt: 'ASC' }, take: BATCH_SIZE }),
    );
    for (const credit of drafts) {
      const outcome = await this.credits.draftOutcome(credit);
      if (!outcome) continue;
      await this.inTenant(companyId, (m) => this.credits.applyDraftOutcome(m, credit, outcome));
      if (outcome.status) this.logger.log(`Crédito ${credit.id} resuelto en segundo plano: ${outcome.status}`);
    }
  }

  private inTenant<T>(companyId: string, work: (m: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.current_company_id', $1, true)`, [companyId]);
      return work(m);
    });
  }
}
