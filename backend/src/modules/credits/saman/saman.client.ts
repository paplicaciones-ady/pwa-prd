import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Dispatcher, fetch as undiciFetch, ProxyAgent } from 'undici';
import {
  SamanCheck,
  SamanCheckRequest,
  SamanCheckStatus,
  SamanCheckSummary,
  SamanError,
  SamanTaskCreated,
  SamanValidationError,
  SamanVerdict,
} from './saman.types';

/**
 * Límite de cada llamada. El usuario espera como máximo un minuto en total
 * (consultas cada 10 s), así que una llamada colgada no puede comérselo.
 */
const REQUEST_TIMEOUT_MS = 8_000;
const SIMULATED_PREFIX = 'sim:';

/** Datos del crédito con los que se arma la petición a Saman. */
export interface SamanStudyInput {
  personType: string;
  /** Como se guarda en credits.nit: jurídica NIT con DV; natural cédula sin DV. Solo dígitos. */
  nit: string;
}

/**
 * Cliente del algoritmo de estudio de crédito (Saman):
 *   requestStudy  POST {SAMAN_API_URL}/api/v1/check/async    → task_id
 *   checkStudy    GET  {SAMAN_API_URL}/api/v1/check/{task_id} → RUNNING | COMPLETED | FAILED
 *
 * Red: el backend no tiene egreso directo a Internet; con SAMAN_HTTPS_PROXY
 * las llamadas van por el proxy con lista blanca (servicio egress-proxy). Se usa
 * el fetch de `undici` porque el fetch global de Node ignora los proxies.
 *
 * Autenticación: `Authorization: Bearer {SAMAN_API_KEY}`. El token se rota a
 * mano (cambiar SAMAN_API_KEY y reiniciar el backend); un 401/403 se reporta
 * como SamanError('auth') con el `detail` de Saman.
 *
 * Errores: siempre SamanError con su tipo (ver SamanErrorType).
 *
 * Sin SAMAN_API_URL funciona en modo simulado: tras SAMAN_SIMULATED_DELAY_MS
 * responde según SAMAN_SIMULATED_RESULT (approved | rejected | failed).
 */
@Injectable()
export class SamanClient implements OnApplicationBootstrap {
  private readonly logger = new Logger(SamanClient.name);

  private dispatcher: Dispatcher | undefined;

  constructor(private readonly config: ConfigService) {
    const proxy = this.config.get<string>('SAMAN_HTTPS_PROXY');
    if (proxy) this.dispatcher = new ProxyAgent(proxy);
  }

  /** Toda llamada a Saman pasa por aquí: aplica el proxy de salida si está configurado. */
  private send(url: string, init: Parameters<typeof undiciFetch>[1] = {}) {
    return undiciFetch(url, { ...init, dispatcher: this.dispatcher });
  }

  /**
   * Al arrancar comprueba (sin bloquear el arranque) que SAMAN_API_URL resuelva
   * y responda. No va en el health check: si Saman cae, el backend no debe
   * marcarse como no disponible. Cualquier respuesta HTTP cuenta como alcanzable.
   */
  onApplicationBootstrap() {
    if (this.simulated) return;
    const via = this.dispatcher ? ' vía proxy de salida' : '';
    this.send(this.baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      .then((res) => this.logger.log(`Saman alcanzable en ${this.baseUrl}${via} (HTTP ${res.status})`))
      .catch((err: Error & { cause?: { code?: string; message?: string } }) =>
        this.logger.error(
          `No se puede alcanzar SAMAN_API_URL (${this.baseUrl})${via}: ${err.cause?.code ?? err.name} ${err.cause?.message ?? err.message}. ` +
            'Revisa el proxy de salida (egress-proxy y su lista blanca) o la salida a Internet/DNS.',
        ),
      );
  }

  private get baseUrl(): string {
    return (this.config.get<string>('SAMAN_API_URL') ?? '').replace(/\/+$/, '');
  }

  get simulated(): boolean {
    return this.baseUrl === '';
  }

  /**
   * Cuerpo exacto de POST /api/v1/check/async. Lo usan el envío y la vista
   * previa del paso 1, así lo que confirma el asesor es lo que se envía.
   *   tipo           natural → cc, jurídica → nit
   *   identificacion jurídica: NIT con guion antes del DV (900123456-7); natural: la cédula, sin DV
   *   empresa        SAMAN_EMPRESA
   *   externas       SAMAN_EXTERNAS
   */
  buildRequest(input: SamanStudyInput): SamanCheckRequest {
    const juridica = input.personType === 'juridica';
    return {
      tipo: juridica ? 'nit' : 'cc',
      empresa: this.config.get<string>('SAMAN_EMPRESA') ?? '',
      identificacion: juridica ? `${input.nit.slice(0, -1)}-${input.nit.slice(-1)}` : input.nit,
      externas: this.config.get<boolean>('SAMAN_EXTERNAS') ?? false,
    };
  }

  /** Crea la tarea de estudio y devuelve su task_id. */
  async requestStudy(input: SamanStudyInput): Promise<string> {
    if (this.simulated) {
      this.logger.warn('SAMAN_API_URL vacío: estudio en modo simulado');
      return `${SIMULATED_PREFIX}${Date.now()}`;
    }
    const created = (await this.call('POST', '/api/v1/check/async', this.buildRequest(input))) as SamanTaskCreated;
    if (!created?.task_id) throw new SamanError('transient', 'Saman no devolvió el task_id');
    return String(created.task_id);
  }

  /** Estado de la tarea: en proceso, pre-aprobado o rechazado (o SamanError). */
  async checkStudy(taskId: string): Promise<SamanVerdict> {
    const status = taskId.startsWith(SIMULATED_PREFIX)
      ? this.simulatedStatus(taskId)
      : ((await this.call('GET', `/api/v1/check/${encodeURIComponent(taskId)}`)) as SamanCheckStatus);
    return this.toVerdict(status);
  }

  /**
   *   RUNNING    sigue en proceso.
   *   COMPLETED  con `check`: approved → pre-aprobado con recommended_limit (si
   *              es 0, error); no approved → rechazado. Sin `check`, error.
   *   FAILED     SamanError('failed') con el `info` de Saman.
   *   otro       se trata como en proceso y se registra, para detectar estados nuevos.
   */
  private toVerdict(res: SamanCheckStatus): SamanVerdict {
    const status = String(res?.status ?? '').toUpperCase();
    if (status === 'RUNNING') return { status: 'processing' };

    if (status === 'FAILED') {
      throw new SamanError('failed', res?.info || 'Saman no indicó el motivo del error');
    }

    if (status === 'COMPLETED') {
      const check = res?.check;
      if (!check || typeof check !== 'object') {
        throw new SamanError('definitive', 'Saman terminó el estudio sin resultado');
      }
      const summary = summarize(check);
      if (!check.approved) return { status: 'rejected', summary };
      if (!(Number(check.recommended_limit) > 0)) {
        throw new SamanError('definitive', 'Saman aprobó el estudio sin cupo (recommended_limit = 0)', summary);
      }
      return { status: 'pre_approved', approvedLimit: Number(check.recommended_limit), summary };
    }

    this.logger.warn(`Saman devolvió un status no reconocido: "${res?.status}"; se trata como en proceso`);
    return { status: 'processing' };
  }

  private async call(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<unknown> {
    let res: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      res = await this.send(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.config.get<string>('SAMAN_API_KEY') ?? ''}`,
          ...(payload ? { 'Content-Type': 'application/json' } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new SamanError('transient', `Saman no respondió (${(err as Error).name}): ${(err as Error).message}`);
    }

    const body: any = await res.json().catch(() => null);
    if (res.ok) return body;

    if (res.status === 401 || res.status === 403) {
      const detail = typeof body?.detail === 'string' ? body.detail : 'Credencial de Saman rechazada';
      throw new SamanError('auth', detail);
    }
    if (res.status === 422) {
      const detail = (body as SamanValidationError)?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => `${d.loc?.slice(1).join('.') || d.loc?.join('.')}: ${d.msg}`).join('; ')
        : 'datos inválidos';
      throw new SamanError('definitive', `Saman rechazó la solicitud: ${msg}`);
    }
    if (res.status >= 500 || res.status === 429 || res.status === 408) {
      throw new SamanError('transient', `Saman respondió ${res.status} en ${method} ${path}`);
    }
    throw new SamanError('definitive', `Saman respondió ${res.status} en ${method} ${path}`);
  }

  /** Respuesta simulada con la misma forma y estados que Saman. */
  private simulatedStatus(taskId: string): SamanCheckStatus {
    const sentAt = Number(taskId.slice(SIMULATED_PREFIX.length));
    const delay = Number(this.config.get('SAMAN_SIMULATED_DELAY_MS') ?? 20_000);
    if (Date.now() - sentAt < delay) return { status: 'RUNNING', info: '' };

    const result = this.config.get<string>('SAMAN_SIMULATED_RESULT') || 'approved';
    if (result === 'failed') {
      return { status: 'FAILED', info: 'Simulado: no fue posible consultar las centrales de riesgo.' };
    }
    const approved = result !== 'rejected';
    return {
      status: 'COMPLETED',
      info: '',
      check: {
        score: approved ? 700 : 420,
        pm: 0,
        be: 0,
        approved,
        recommended_limit: approved ? 2_000_000 : 0,
        total_credit_line: approved ? 2_000_000 : 0,
        reason: approved ? 'Simulado: perfil con buen comportamiento.' : 'Simulado: puntaje insuficiente.',
        tipo_persona: 'person',
        external_id: taskId,
      },
    };
  }
}

function summarize(check: SamanCheck): SamanCheckSummary {
  const ext = check.external_data ?? null;
  return {
    score: Number(check.score ?? 0),
    pm: Number(check.pm ?? 0),
    be: Number(check.be ?? 0),
    approved: !!check.approved,
    recommendedLimit: Number(check.recommended_limit ?? 0),
    totalCreditLine: Number(check.total_credit_line ?? 0),
    reason: check.reason ?? '',
    tipoPersona: check.tipo_persona ?? null,
    externalId: check.external_id ?? null,
    checkId: ext?.check_id ?? null,
    juridica: ext?.juridica ?? null,
    natural: ext?.natural ?? null,
  };
}
