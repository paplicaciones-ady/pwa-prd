import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface SignaturePadProps {
  /** Data URL PNG de la firma, o null cuando el pad está vacío. */
  onChange: (dataUrl: string | null) => void;
  height?: number;
  /** Ancho máximo del PNG exportado; por encima se reduce proporcionalmente. */
  maxWidth?: number;
}

const STROKE_COLOR = '#12233a';
const GUIDE_COLOR = '#d5dfea';
const LINE_WIDTH = 2.2;

/** Teléfono: puntero táctil y el lado corto de la pantalla pequeño (en vertical u horizontal). */
export const PHONE_QUERY = '(pointer: coarse) and (max-width: 600px), (pointer: coarse) and (max-height: 600px)';

/** true en teléfonos: ahí la firma se toma a pantalla completa y en horizontal. */
export function useIsPhone() {
  return useMediaQuery(PHONE_QUERY);
}

/** Pad de firma en línea, de alto fijo. */
export function SignaturePad({ onChange, height = 160, maxWidth = 800 }: SignaturePadProps) {
  return <SignatureSurface onChange={onChange} height={height} maxWidth={maxWidth} />;
}

interface SignatureFullscreenProps {
  open: boolean;
  title: string;
  /** Texto corto sobre el lienzo (p. ej. lo que se autoriza). */
  children?: ReactNode;
  confirmLabel?: string;
  onCancel: () => void;
  /** Recibe la firma al confirmar; solo se habilita con algo firmado. */
  onConfirm: (dataUrl: string) => void;
  maxWidth?: number;
}

/**
 * Modal de firma para teléfono, a pantalla completa. Con el teléfono en
 * vertical el contenido se gira 90° para firmar con el dispositivo de lado,
 * a lo ancho, sin depender de que el usuario tenga activada la rotación.
 */
export function SignatureFullscreen({
  open,
  title,
  children,
  confirmLabel = 'Confirmar',
  onCancel,
  onConfirm,
  maxWidth = 800,
}: SignatureFullscreenProps) {
  const portrait = useMediaQuery('(orientation: portrait)');
  // La firma en curso solo se entrega al confirmar; cancelar conserva la anterior.
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(null);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  // Portal: un ancestro con transform/backdrop-filter haría que el
  // `position: fixed` se ubique respecto a él y no a la pantalla.
  return createPortal(
    <div className="sigfull" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`sigfull-stage ${portrait ? 'rotated' : ''}`}>
        <div className="sigfull-head">
          <div className="sigfull-title">{title}</div>
          {children && <div className="sigfull-text">{children}</div>}
        </div>
        <SignatureSurface
          fill
          rotated={portrait}
          maxWidth={maxWidth}
          onChange={setDraft}
          actions={
            <>
              <button type="button" className="sigpad-clear" onClick={onCancel}>
                Cancelar
              </button>
              <button
                type="button"
                className="sigpad-accept"
                disabled={!draft}
                onClick={() => draft && onConfirm(draft)}
              >
                {confirmLabel}
              </button>
            </>
          }
        />
      </div>
    </div>,
    document.body
  );
}

interface SignatureSurfaceProps {
  onChange: (dataUrl: string | null) => void;
  /** Alto fijo del lienzo; se ignora con `fill`. */
  height?: number;
  maxWidth: number;
  /** El lienzo ocupa todo el alto disponible del contenedor. */
  fill?: boolean;
  /** El lienzo está girado 90° en sentido horario con CSS. */
  rotated?: boolean;
  /** Botones extra al pie, junto a "Limpiar". */
  actions?: ReactNode;
}

/**
 * Lienzo de firma sobre canvas, sin dependencias.
 *
 * Decisiones que no son obvias:
 * - `touch-action: none` en línea: sin esto el scroll del contenedor roba el
 *   trazo en móvil a mitad de la firma.
 * - El contexto se escala por `devicePixelRatio` una sola vez, así que todo el
 *   dibujo ocurre en píxeles CSS y no hay que multiplicar por el ratio en cada
 *   punto.
 * - El fondo se pinta blanco: un PNG transparente se ve negro sobre el tema
 *   oscuro, y la firma se va a imprimir y a archivar.
 * - `getCoalescedEvents()` recupera los puntos que el navegador agrupó entre
 *   frames; sin eso el trazo sale poligonal al firmar rápido.
 * - El resize no borra lo firmado: se copia el canvas a uno auxiliar antes de
 *   cambiar sus dimensiones (cambiar `width` lo limpia) y se reescala.
 * - Girado, el canvas conserva su sistema de coordenadas propio (el PNG sale
 *   horizontal); solo hay que traducir el punto de pantalla a ese sistema.
 */
function SignatureSurface({ onChange, height = 160, maxWidth, fill = false, rotated = false, actions }: SignatureSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const dprRef = useRef(1);
  const sizeRef = useRef({ w: 0, h: 0 });
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const lengthRef = useRef(0);
  const [empty, setEmpty] = useState(true);

  const paintBackground = useCallback((w: number, h: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, h - 28);
    ctx.lineTo(w - 16, h - 28);
    ctx.stroke();
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // clientWidth/clientHeight son el tamaño de layout, sin el giro del transform.
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (!cssWidth || !cssHeight) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const nextW = Math.round(cssWidth * dpr);
    const nextH = Math.round(cssHeight * dpr);
    if (canvas.width === nextW && canvas.height === nextH) return;

    // Copia previa: asignar width/height borra el contenido del canvas.
    let previous: HTMLCanvasElement | null = null;
    if (canvas.width && canvas.height && lengthRef.current > 0) {
      previous = document.createElement('canvas');
      previous.width = canvas.width;
      previous.height = canvas.height;
      previous.getContext('2d')?.drawImage(canvas, 0, 0);
    }

    canvas.width = nextW;
    canvas.height = nextH;
    dprRef.current = dpr;
    sizeRef.current = { w: cssWidth, h: cssHeight };

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBackground(cssWidth, cssHeight);

    if (previous) {
      ctx.drawImage(previous, 0, 0, cssWidth, cssHeight);
    }
  }, [paintBackground]);

  useEffect(() => {
    resize();
    const observer = new ResizeObserver(resize);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [resize]);

  /** Punto de pantalla → coordenadas del canvas (en píxeles CSS). */
  const toLocal = (clientX: number, clientY: number, rect: DOMRect) =>
    rotated
      ? // Girado 90° horario: el eje x del canvas apunta hacia abajo en pantalla
        // y el eje y hacia la izquierda.
        { x: clientY - rect.top, y: rect.right - clientX }
      : { x: clientX - rect.left, y: clientY - rect.top };

  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width) return;
    if (lengthRef.current === 0) {
      onChange(null);
      return;
    }

    const { w: cssWidth, h: cssHeight } = sizeRef.current;
    if (cssWidth <= maxWidth) {
      onChange(canvas.toDataURL('image/png'));
      return;
    }

    const out = document.createElement('canvas');
    out.width = maxWidth;
    out.height = Math.round((maxWidth * cssHeight) / cssWidth);
    const outCtx = out.getContext('2d');
    if (!outCtx) return;
    outCtx.fillStyle = '#ffffff';
    outCtx.fillRect(0, 0, out.width, out.height);
    outCtx.drawImage(canvas, 0, 0, out.width, out.height);
    onChange(out.toDataURL('image/png'));
  }, [maxWidth, onChange]);

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const point = toLocal(e.clientX, e.clientY, canvas.getBoundingClientRect());
    lastRef.current = point;
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    // Un toque sin arrastre no deja trazo visible; se avanza una fracción de
    // píxel para que el siguiente movimiento parta de un punto real.
    ctx.lineTo(point.x + 0.01, point.y);
    ctx.stroke();
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    const last = lastRef.current;
    if (!ctx || !canvas || !last) return;

    const rect = canvas.getBoundingClientRect();
    const events =
      typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [];

    for (const raw of events.length ? events : [e.nativeEvent]) {
      const point = toLocal(raw.clientX, raw.clientY, rect);
      const prev = lastRef.current ?? last;
      const segment = Math.hypot(point.x - prev.x, point.y - prev.y);
      if (segment === 0) continue;
      // Curva cuadrática por el punto medio: suaviza el trazo sin inventar
      // puntos intermedios.
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + point.x) / 2, (prev.y + point.y) / 2);
      ctx.stroke();
      lastRef.current = point;
      lengthRef.current += segment;
    }
  };

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    drawingRef.current = false;
    lastRef.current = null;
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
    setEmpty(lengthRef.current === 0);
    emit();
  };

  const clear = () => {
    lengthRef.current = 0;
    lastRef.current = null;
    paintBackground(sizeRef.current.w, sizeRef.current.h);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className={`sigpad ${fill ? 'fill' : ''}`}>
      <div className="sigpad-area" style={fill ? undefined : { height }}>
        <canvas
          ref={canvasRef}
          className="sigpad-canvas"
          style={{ touchAction: 'none' }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          aria-label="Área de firma"
        />
        {empty && <div className="sigpad-hint">Firme aquí con el dedo o el mouse</div>}
      </div>
      <div className="sigpad-foot">
        <span className="sigpad-note">La firma queda registrada como parte del expediente</span>
        <div className="sigpad-actions">
          <button type="button" className="sigpad-clear" onClick={clear}>
            Limpiar
          </button>
          {actions}
        </div>
      </div>
    </div>
  );
}
