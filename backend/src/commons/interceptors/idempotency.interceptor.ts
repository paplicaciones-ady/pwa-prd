import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  ConflictException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { finalize, mergeMap } from 'rxjs/operators';
import { createHash } from 'crypto';
import Redis from 'ioredis';

const RESULT_TTL_SECONDS = 24 * 60 * 60;
const LOCK_TTL_SECONDS = 15;

/**
 * Idempotencia por clave (ISO 27001 / OWASP A04 — operaciones críticas no
 * duplicables por retry):
 *
 * - Sobre mutaciones (POST/PATCH/PUT/DELETE) con header `Idempotency-Key`,
 *   guarda la respuesta (y su status) en Redis con TTL 24h.
 * - Un segundo request con la misma clave (mismo usuario + ruta + key)
 *   devuelve la respuesta almacenada sin re-ejecutar la operación.
 * - Un lock corto (SET NX) serializa duplicados concurrentes: si la misma
 *   operación está en curso, el segundo request recibe 409 (double-click).
 * - Sin header (clientes externos): comportamiento normal, sin dedupe.
 * - Redis caído: fail-open (se sigue operando sin dedupe), igual que Kong.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(Redis) private readonly redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const method = (req.method ?? 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();

    const key = req.headers['idempotency-key'];
    if (!key || typeof key !== 'string' || key.length === 0 || key.length > 128) {
      return next.handle();
    }

    const actor = req.user?.sub ?? req.ip ?? 'anon';
    const cacheKey = `idempotency:${createHash('sha256')
      .update(`${actor}:${req.originalUrl || req.url}:${key}`)
      .digest('hex')}`;

    // La respuesta guardada se devuelve como valor del flujo para que Nest la
    // envíe una sola vez. Escribirla a mano (res.json) y devolver EMPTY hacía
    // que Nest lanzara EmptyError e intentara responder de nuevo
    // (ERR_HTTP_HEADERS_SENT), lo que tumbaba el proceso ante un reintento.
    const replay = async (): Promise<Observable<unknown> | null> => {
      try {
        const existing = await this.redis.get(cacheKey);
        if (!existing) return null;
        const stored = JSON.parse(existing) as { body: unknown; status: number };
        context.switchToHttp().getResponse().status(stored.status ?? 200);
        return of(stored.body);
      } catch {
        return null; // Redis caído: continuar sin dedupe esta request.
      }
    };

    const cached = await replay();
    if (cached) return cached;

    const lockKey = `${cacheKey}:lock`;
    let acquired: 'OK' | null | undefined;
    try {
      acquired = await this.redis.set(lockKey, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    } catch {
      acquired = undefined;
    }
    if (acquired === null) {
      throw new ConflictException('Operación duplicada en curso');
    }

    const release = () => {
      if (acquired) this.redis.del(lockKey).catch(() => undefined);
    };

    // Segunda lectura ya con el lock: la operación original pudo terminar (y
    // liberar el lock) entre la primera lectura y este punto.
    const cachedAfterLock = await replay();
    if (cachedAfterLock) {
      release();
      return cachedAfterLock;
    }

    // El resultado se guarda ANTES de liberar el lock: si se liberara primero, un
    // duplicado que llegue en ese hueco no vería ni lock ni resultado y
    // re-ejecutaría la operación.
    return next.handle().pipe(
      mergeMap(async (value) => {
        const res = context.switchToHttp().getResponse();
        const body = value ?? { success: true };
        const status = res.statusCode && res.statusCode !== 200 ? res.statusCode : (method === 'POST' ? 201 : 200);
        await this.redis.set(cacheKey, JSON.stringify({ body, status }), 'EX', RESULT_TTL_SECONDS).catch(() => undefined);
        return body;
      }),
      finalize(release),
    );
  }
}