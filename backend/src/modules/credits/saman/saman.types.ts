/**
 * Contrato HTTP de Saman (algoritmo de estudio de crédito). Solo tipos: lo que
 * se persiste del resultado es `SamanAlgorithmResult`, en credits.algorithm_result.
 */

/** POST /api/v1/check/async */
export interface SamanCheckRequest {
  tipo: 'cc' | 'nit';
  empresa: string;
  /** Jurídica: NIT con guion antes del DV (900123456-7). Natural: cédula sin DV. */
  identificacion: string;
  externas: boolean;
}

/** 201 de POST /api/v1/check/async */
export interface SamanTaskCreated {
  task_id: string;
}

/** 200 de GET /api/v1/check/{task_id} (solo los campos que se usan). */
export interface SamanCheckStatus {
  /** RUNNING | COMPLETED | FAILED */
  status: string;
  /** En FAILED, el motivo del error. */
  info: string;
  /** Presente cuando la tarea terminó: es lo que indica que hay veredicto. */
  check?: SamanCheck | null;
}

export interface SamanCheck {
  score: number;
  pm: number;
  be: number;
  approved: boolean;
  recommended_limit: number;
  reason: string;
  total_credit_line: number;
  external_data?: {
    check_id?: string;
    credit_data?: unknown;
    personal_data?: unknown;
    scores?: unknown;
    juridica?: {
      razon_social?: string;
      estado?: string;
      fecha_matricula?: string;
      representante_legal?: string;
      documento_representante_legal?: string;
    } | null;
    natural?: {
      estado_afiliacion?: string;
      tipo_afiliacion?: string;
      regimen_afiliacion?: string;
    } | null;
  } | null;
  tipo_persona?: string;
  external_id?: string;
}

/** 422 (formato de error de validación de FastAPI). */
export interface SamanValidationError {
  detail: { loc: (string | number)[]; msg: string; type: string }[];
}

/**
 * Por qué no se obtuvo el veredicto:
 *   auth        401/403: el token no es válido, venció o fue revocado. La
 *               solicitud está bien; se reintenta cuando se cambie el token.
 *   transient   red, timeout o 5xx: se reintenta solo.
 *   failed      Saman respondió status FAILED; `info` trae el motivo. Se
 *               muestra como advertencia y no se reintenta solo.
 *   definitive  datos rechazados (422), COMPLETED sin resultado, aprobado sin
 *               cupo o tarea caducada: no se reintenta solo (el asesor decide).
 */
export type SamanErrorType = 'auth' | 'transient' | 'failed' | 'definitive';

/** Errores tras los que el estudio espera al asesor (Reintentar / Corregir y crear de nuevo). */
export const STOPPING_ERRORS: readonly SamanErrorType[] = ['failed', 'definitive'];

export class SamanError extends Error {
  constructor(
    readonly type: SamanErrorType,
    message: string,
    /** Resumen del check cuando el error viene de un veredicto inválido (cupo 0). */
    readonly summary?: SamanCheckSummary,
  ) {
    super(message);
    this.name = 'SamanError';
  }
}

/** Lo que se conserva del check: sin credit_data, personal_data ni scores (datos sensibles). */
export interface SamanCheckSummary {
  score: number;
  pm: number;
  be: number;
  approved: boolean;
  recommendedLimit: number;
  totalCreditLine: number;
  reason: string;
  tipoPersona: string | null;
  externalId: string | null;
  checkId: string | null;
  juridica: NonNullable<NonNullable<SamanCheck['external_data']>['juridica']> | null;
  natural: NonNullable<NonNullable<SamanCheck['external_data']>['natural']> | null;
}

export type SamanVerdict =
  | { status: 'processing' }
  | { status: 'pre_approved'; approvedLimit: number; summary: SamanCheckSummary }
  | { status: 'rejected'; summary: SamanCheckSummary };

/** Contenido de credits.algorithm_result. */
export interface SamanAlgorithmResult extends Partial<SamanCheckSummary> {
  /** Cuándo se creó la tarea en Saman: base de la caducidad. */
  sentAt?: string;
  /** Último error; se limpia cuando llega un veredicto. */
  error?: {
    type: SamanErrorType;
    message: string;
    at: string;
    /** Errores transitorios seguidos (red caída): a partir de 3 el front deja de esperar. */
    streak?: number;
  } | null;
}
