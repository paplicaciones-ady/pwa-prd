import { useState } from 'react';

interface ScaleInputProps {
  value: number | null;
  onChange: (value: number) => void;
  lowLabel?: string;
  highLabel?: string;
  tooltip?: string;
  ariaLabel?: string;
}

/**
 * Escala 1 a 5 con steps de 1 (input range nativo) y un ícono de información
 * que despliega el texto de ayuda. El badge muestra "—" mientras no se elige,
 * para que el estado inicial no se confunda con una respuesta válida.
 */
export function ScaleInput({
  value,
  onChange,
  lowLabel = '1',
  highLabel = '5',
  tooltip,
  ariaLabel = 'Calificación',
}: ScaleInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="scale">
      <div className="scale-head">
        <span className="scale-val">
          {value ?? '—'}
          <span className="scale-of">/5</span>
        </span>
        {tooltip && (
          <span className="tip">
            <button
              type="button"
              className="tip-btn"
              aria-label="Información"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M12 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="7.8" r="1.1" fill="currentColor" />
              </svg>
            </button>
            <span className={`tip-bubble ${open ? 'on' : ''}`} role="tooltip">
              {tooltip}
            </span>
          </span>
        )}
      </div>

      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value ?? 3}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      <div className="scale-ends">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
