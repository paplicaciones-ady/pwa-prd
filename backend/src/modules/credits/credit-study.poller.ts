import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';
import { Credit, CreditStatus } from './entities/credit.entity';
import { CreditsService } from './credits.service';

/** Borradores que se revisan por empresa en cada vuelta. */
const BATCH_SIZE = 50;
/** Tras un 401/403 de Saman no se le llama durante este tiempo: con el mismo token fallaría igual. */
const AUTH_PAUSE_MS = 5 * 60_000;
const INTERVAL_NAME = 'credit-study-poller';

/**
 * Resuelve en segundo plano los borradores que el front dejó de consultar
 * (pasado el primer minuto): cada CREDIT_STUDY_POLL_INTERVAL_MS recorre las
 * empresas, consulta a Saman los borradores que toca (esperas crecientes por
 * crédito, ver CreditsService.draftOutcome) y aplica el resultado.
 *
 * Se registra en el SchedulerRegistry de @nestjs/schedule (el intervalo sale
 * del .env, por eso no es un @Interval fijo), que lo detiene al apagar.
 *
 * RLS: fuera de un request no hay TenantContextInterceptor, así que cada
 * lectura/escritura corre en una transacción con `app.current_company_id`
 * local a ella. Las llamadas a Saman van fuera de las transacciones para no
 * retener conexiones del pool mientras se espera la red.
 *
 * Varias instancias del backend pueden correrlo a la vez sin daño:
 * `applyDraftOutcome` solo escribe si el crédito sigue en borrador.
 */
@Injectable()
export class CreditStudyPoller implements OnModuleInit {
  private readonly logger = new Logger(CreditStudyPoller.name);
  private running = false;
  private pausedUntil = 0;

  constructor(
    private readonly dataSource: DataSource,
    private readonly credits: CreditsService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const interval = Number(this.config.get('CREDIT_STUDY_POLL_INTERVAL_MS') ?? 30_000);
    if (interval <= 0) return;
    this.scheduler.addInterval(INTERVAL_NAME, setInterval(() => void this.tick(), interval));
  }

  async tick() {
    // Una vuelta lenta (Saman caído, timeouts) no se solapa con la siguiente.
    if (this.running || Date.now() < this.pausedUntil) return;
    this.running = true;
    try {
      const companies: { id: string }[] = await this.dataSource.query(`SELECT id FROM companies WHERE is_active`);
      for (const { id } of companies) {
        if (Date.now() < this.pausedUntil) break;
        await this.resolveCompany(id);
      }
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
      const outcome = await this.credits.draftOutcome(credit, {
        respectBackoff: true,
        // La reserva también va con el tenant fijado (RLS).
        claim: (c) => this.inTenant(companyId, (m) => this.credits.claimDraft(m, c)),
      });
      if (!outcome) continue;
      await this.inTenant(companyId, (m) => this.credits.applyDraftOutcome(m, credit, outcome));
      if (outcome.status) this.logger.log(`Crédito ${credit.id} resuelto en segundo plano: ${outcome.status}`);
      if (outcome.algorithmResult?.error?.type === 'auth') {
        this.pausedUntil = Date.now() + AUTH_PAUSE_MS;
        this.logger.error(`Saman rechazó la credencial; sondeo en pausa ${AUTH_PAUSE_MS / 60_000} min. Revisa SAMAN_API_KEY.`);
        return;
      }
    }
  }

  private inTenant<T>(companyId: string, work: (m: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.current_company_id', $1, true)`, [companyId]);
      return work(m);
    });
  }
}
