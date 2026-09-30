import { useCallback, useEffect, useRef, useState } from 'react';

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

/**
 * Pad de firma sobre canvas, sin dependencias.
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
 *   frames; sin eso el trazo sale poligonal al firmrar rápido.
 * - El resize no borra lo firmado: se copia el canvas a uno auxiliar antes de
 *   cambiar sus dimensiones (cambiar `width` lo limpia) y se reescala.
 */
export function SignaturePad({ onChange, height = 160, maxWidth = 800 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const dprRef = useRef(1);
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
    const cssWidth = canvas.clientWidth;
    if (!cssWidth) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const nextW = Math.round(cssWidth * dpr);
    const nextH = Math.round(height * dpr);
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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBackground(cssWidth, height);

    if (previous) {
      ctx.drawImage(previous, 0, 0, cssWidth, height);
    }
  }, [height, paintBackground]);

  useEffect(() => {
    resize();
    const observer = new ResizeObserver(resize);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [resize]);

  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width) return;
    if (lengthRef.current === 0) {
      onChange(null);
      return;
    }

    const dpr = dprRef.current;
    const cssWidth = canvas.width / dpr;
    const cssHeight = canvas.height / dpr;
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
    const rect = canvas.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
      const point = { x: raw.clientX - rect.left, y: raw.clientY - rect.top };
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      const segment = Math.hypot(dx, dy);
      if (segment === 0) continue;
      // Curva cuadrática por el punto medio: suaviza el trazo sin inventar
      // puntos intermedios.
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.quadraticCurveTo(last.x, last.y, (last.x + point.x) / 2, (last.y + point.y) / 2);
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    lengthRef.current = 0;
    lastRef.current = null;
    paintBackground(canvas.width / dprRef.current, height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="sigpad">
      <canvas
        ref={canvasRef}
        className="sigpad-canvas"
        style={{ height, touchAction: 'none' }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        aria-label="Área de firma"
      />
      {empty && <div className="sigpad-hint">Firme aquí con el dedo o el mouse</div>}
      <div className="sigpad-foot">
        <span className="sigpad-note">La firma queda registrada como parte del expediente</span>
        <button type="button" className="sigpad-clear" onClick={clear}>
          Limpiar
        </button>
      </div>
    </div>
  );
}
