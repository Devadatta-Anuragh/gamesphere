import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ---------------------------------------------------------------- Card --- */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface/70 backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('p-4', className)}>{children}</div>;
}

/* --------------------------------------------------------------- Badge --- */
type Tone = 'brand' | 'green' | 'amber' | 'red' | 'slate' | 'cyan';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand/10 text-brand border-brand/30',
  green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  red: 'bg-red-500/10 text-red-300 border-red-500/30',
  cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  slate: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
};

export function Badge({
  tone = 'slate',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = 'green' }: { tone?: Tone }) {
  const color =
    tone === 'green'
      ? 'bg-emerald-400'
      : tone === 'amber'
        ? 'bg-amber-400'
        : tone === 'red'
          ? 'bg-red-400'
          : 'bg-brand';
  return (
    <span className={cn('h-2 w-2 rounded-full animate-pulse-dot', color)} />
  );
}

/* ----------------------------------------------------------- StatCard --- */
export function StatCard({
  label,
  value,
  hint,
  tone = 'brand',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  const accent =
    tone === 'green'
      ? 'text-emerald-300'
      : tone === 'cyan'
        ? 'text-cyan-300'
        : tone === 'amber'
          ? 'text-amber-300'
          : 'text-brand';
  return (
    <Card className="px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className={cn('mt-1 font-mono text-2xl font-semibold', accent)}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

/* ------------------------------------------------------------- Section --- */
export function SectionTitle({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold text-ink">{children}</h2>
      {right}
    </div>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
  );
}
