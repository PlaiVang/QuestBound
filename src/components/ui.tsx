import type { ReactNode } from 'react';
import { CLASSES } from '../game/classes';
import type { ClassId } from '../game/types';
import { PixelArt } from './PixelArt';

export function Bar({ value, max, color, label }: { value: number; max: number; color?: string; label?: ReactNode }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="progress">
      <div className="bar" role={typeof label === 'string' ? 'progressbar' : undefined}
        aria-label={typeof label === 'string' ? label : undefined}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className="fill" style={{ transform: `scaleX(${pct / 100})`, background: color }} />
      </div>
      {label !== undefined && <div className="progress-label">{label}</div>}
    </div>
  );
}

export function ClassChip({ id, overridden }: { id: ClassId; overridden?: boolean }) {
  const c = CLASSES[id];
  return (
    <span className="chip" style={{ borderColor: c.color }} title={c.runType}>
      <PixelArt name={id} /> {c.name}
      {overridden && <span className="muted tiny">✎</span>}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat-box">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export function Gold({ amount }: { amount: number }) {
  return <span className="gold"><PixelArt name="coin" size={20} /> {amount.toLocaleString()}</span>;
}
