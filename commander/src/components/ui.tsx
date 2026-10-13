import type { ButtonHTMLAttributes, ReactNode } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { cn } from '../lib/cn';

export function Button({ className, variant = 'default', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'quiet' }) {
  return (
    <button
      className={cn(
        'inline-flex min-h-9 items-center justify-center gap-2 border px-3 py-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-signal disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'default' && 'border-line bg-raised text-ink hover:border-muted hover:bg-[#292d29]',
        variant === 'primary' && 'border-signal bg-signal text-canvas hover:bg-[#f0b546]',
        variant === 'danger' && 'border-danger bg-danger text-white hover:bg-[#e25b4b]',
        variant === 'quiet' && 'border-transparent bg-transparent text-muted hover:bg-raised hover:text-ink',
        className
      )}
      {...props}
    />
  );
}

export function Panel({ children, className, title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={cn('border border-line bg-panel shadow-sm', className)}>
      {title ? (
        <div className="flex min-h-11 items-center justify-between border-b border-line px-4 py-2">
          <h2 className="text-balance text-sm font-semibold text-ink">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatusTag({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'success' | 'warning' | 'danger'; children: ReactNode; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px] font-medium tabular-nums',
      tone === 'neutral' && 'border-line bg-raised text-muted',
      tone === 'success' && 'border-success/50 bg-success/10 text-[#9bc79a]',
      tone === 'warning' && 'border-warning/50 bg-warning/10 text-[#e9b85d]',
      tone === 'danger' && 'border-danger/60 bg-danger/10 text-[#ef8d82]',
      className
    )}>
      <span className={cn('size-1.5 rounded-full', tone === 'neutral' && 'bg-muted', tone === 'success' && 'bg-success', tone === 'warning' && 'bg-warning', tone === 'danger' && 'bg-danger')} />
      {children}
    </span>
  );
}

export function Metric({ label, value, unit, tone }: { label: string; value: ReactNode; unit?: string; tone?: 'danger' | 'warning' | 'success' }) {
  return (
    <div className="min-w-0 border-l-2 border-line pl-3">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className={cn('mt-1 truncate font-mono text-lg font-medium tabular-nums text-ink', tone === 'danger' && 'text-[#ef8d82]', tone === 'warning' && 'text-[#e9b85d]', tone === 'success' && 'text-[#9bc79a]')}>
        {value}{unit ? <span className="ml-1 text-xs text-muted">{unit}</span> : null}
      </div>
    </div>
  );
}

export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  danger = false,
  onConfirm
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => unknown | Promise<unknown>;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 border border-line bg-panel p-6 shadow-xl outline-none">
          <AlertDialog.Title className="text-balance text-lg font-semibold text-ink">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-pretty text-sm leading-6 text-muted">{description}</AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild><Button>Cancel</Button></AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={danger ? 'danger' : 'primary'} onClick={() => void onConfirm()}>{confirmLabel}</Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
      <div className="text-balance text-sm font-semibold text-ink">{title}</div>
      <p className="mt-2 max-w-md text-pretty text-sm text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
