const STEPS = ['Estudio', 'Aprobación', 'Firma', 'Desembolso'];

export function CreditStepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flow-track">
      {STEPS.map((label, i) => {
        const num = i + 1;
        const done = num < current;
        const now = num === current;
        const cls = done ? 'fstep done' : now ? 'fstep now' : 'fstep';
        return (
          <div className={cls} key={label}>
            <span className="ln" />
            <span className="dot">
              {done ? (
                <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : (
                num
              )}
            </span>
            <span className="lb">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
