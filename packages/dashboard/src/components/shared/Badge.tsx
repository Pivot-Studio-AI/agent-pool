import { clsx } from 'clsx';

interface BadgeProps {
  color: string;
  children: React.ReactNode;
  className?: string;
}

const colorMap: Record<string, { bg: string; text: string }> = {
  accent: { bg: 'bg-accent/15', text: 'text-accent' },
  green: { bg: 'bg-green/15', text: 'text-green' },
  amber: { bg: 'bg-amber/15', text: 'text-amber' },
  red: { bg: 'bg-red/15', text: 'text-red' },
  purple: { bg: 'bg-purple/15', text: 'text-purple' },
  'text-muted': { bg: 'bg-text-muted/15', text: 'text-text-muted' },
  'text-secondary': { bg: 'bg-text-muted/10', text: 'text-text-secondary' },
};

export function Badge({ color, children, className }: BadgeProps) {
  const mapped = colorMap[color] ?? colorMap['text-secondary']!;
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide uppercase',
        mapped.bg,
        mapped.text,
        className
      )}
    >
      {children}
    </span>
  );
}
