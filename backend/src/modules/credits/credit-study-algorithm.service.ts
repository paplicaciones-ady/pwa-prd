import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Datos del estudio que se envían al algoritmo. */
export interface AlgorithmStudyInput {
  /** Id del crédito: permite al algoritmo correlacionar la tarea con la solicitud. */
  creditId: string;
  nit: string;
  personType: string;
  yearsExperience: number;
  opportunityValue: number;
  reliabilityScore: number;
}

export type AlgorithmVerdict =
  | { status: 'processing' }
  | { status: 'pre_approved'; approvedLimit?: number; reason?: string }
  | { status: 'rejected'; reason?: string };

/** Tiempo máximo de cada llamada HTTP al algoritmo. */
const REQUEST_TIMEOUT_MS = 10_000;
/** Prefijo de los ids de tarea generados en modo simulado. */
const SIMULATED_PREFIX = 'sim:';

/**
 * Cliente del algoritmo de estudio de crédito (Saman). Es el paso que sigue al
 * paso 1: el borrador se envía con `requestStudy()`, que devuelve el id de la
 * tarea (se guarda en `credits.decision_run_id`), y el veredicto se consulta
 * con `checkStudy(taskId)` hasta que deja de estar en proceso.
 *
 * Configuración (.env del backend):
 *   SAMAN_API_URL                  base de la API. Vacía = modo simulado.
 *   SAMAN_API_KEY                  se envía como `Authorization: Bearer`.
 *   SAMAN_SIMULATED_DELAY_MS       solo modo simulado: cuánto tarda el veredicto
 *                                  (por defecto 20 s; >60 s prueba el segundo plano).
 *
 * El contrato HTTP (rutas, cuerpo y estados) es supuesto: no hay especificación
 * de Saman en el proyecto. Está concentrado en `httpRequestStudy` /
 * `httpCheckStudy` / `toVerdict` para adaptarlo en un solo lugar.
 */
@Injectable()
export class CreditStudyAlgorithmService {
  private readonly logger = new Logger(CreditStudyAlgorithmService.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (this.config.get<string>('SAMAN_API_URL') ?? '').replace(/\/+$/, '');
  }

  get simulated(): boolean {
    return this.baseUrl === '';
  }

  /** Envía el estudio al algoritmo y devuelve el id de la tarea. */
  async requestStudy(input: AlgorithmStudyInput): Promise<string> {
    if (this.simulated) return this.simulateRequest(input);
    return this.httpRequestStudy(input);
  }

  /** Consulta el veredicto de una tarea. `processing` mientras no haya decisión. */
  async checkStudy(taskId: string): Promise<AlgorithmVerdict> {
    if (taskId.startsWith(SIMULATED_PREFIX)) return this.simulateCheck(taskId);
    return this.httpCheckStudy(taskId);
  }

  // ---------------------------------------------------------------- HTTP (Saman)

  private async httpRequestStudy(input: AlgorithmStudyInput): Promise<string> {
    const body = await this.fetchJson('POST', '/studies', {
      reference: input.creditId,
      nit: input.nit,
      personType: input.personType,
      yearsExperience: input.yearsExperience,
      opportunityValue: input.opportunityValue,
      reliabilityScore: input.reliabilityScore,
    });
    const taskId = body?.taskId ?? body?.task_id ?? body?.id;
    if (!taskId) throw new Error('Saman no devolvió el id de la tarea');
    return String(taskId);
  }

  private async httpCheckStudy(taskId: string): Promise<AlgorithmVerdict> {
    const body = await this.fetchJson('GET', `/studies/${encodeURIComponent(taskId)}`);
    return this.toVerdict(body);
  }

  /** Traduce la respuesta de Saman a los estados del crédito. */
  private toVerdict(body: any): AlgorithmVerdict {
    const status = String(body?.status ?? '').toLowerCase();
    const reason = body?.reason ?? body?.message;
    if (['approved', 'pre_approved', 'preapproved'].includes(status)) {
      const limit = Number(body?.approvedLimit ?? body?.approved_limit);
      return { status: 'pre_approved', approvedLimit: limit > 0 ? limit : undefined, reason };
    }
    if (['rejected', 'denied'].includes(status)) return { status: 'rejected', reason };
    return { status: 'processing' };
  }

  private async fetchJson(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<any> {
    const apiKey = this.config.get<string>('SAMAN_API_KEY');
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Saman respondió ${res.status} en ${method} ${path}`);
    return res.json();
  }

  // ---------------------------------------------------------------- Simulación

  /**
   * Sin SAMAN_API_URL: la tarea se codifica en el propio id (instante de envío
   * y confiabilidad), así la consulta no necesita estado en memoria y funciona
   * igual tras reiniciar el backend. Confiabilidad >= 3 pre-aprueba.
   */
  private simulateRequest(input: AlgorithmStudyInput): string {
    this.logger.warn(`SAMAN_API_URL vacío: estudio ${input.creditId} en modo simulado`);
    return `${SIMULATED_PREFIX}${Date.now()}:${input.reliabilityScore}`;
  }

  private simulateCheck(taskId: string): AlgorithmVerdict {
    const [sentAt, reliability] = taskId.slice(SIMULATED_PREFIX.length).split(':').map(Number);
    const delay = Number(this.config.get('SAMAN_SIMULATED_DELAY_MS') ?? 20_000);
    if (Date.now() - sentAt < delay) return { status: 'processing' };
    return reliability >= 3
      ? { status: 'pre_approved', reason: 'Simulado: confiabilidad suficiente.' }
      : { status: 'rejected', reason: 'Simulado: confiabilidad insuficiente.' };
  }
}
