import { clsx } from 'clsx';

interface BadgeProps {
  color: string;
  children: React.ReactNode;
  className?: string;
}

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  accent: { bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/25' },
  green: { bg: 'bg-green/10', text: 'text-green', border: 'border-green/25' },
  amber: { bg: 'bg-amber/10', text: 'text-amber', border: 'border-amber/25' },
  red: { bg: 'bg-red/10', text: 'text-red', border: 'border-red/25' },
  purple: { bg: 'bg-purple/10', text: 'text-purple', border: 'border-purple/25' },
  'text-muted': { bg: 'bg-text-muted/10', text: 'text-text-muted', border: 'border-text-muted/15' },
  'text-secondary': { bg: 'bg-text-muted/8', text: 'text-text-secondary', border: 'border-text-muted/15' },
};

export function Badge({ color, children, className }: BadgeProps) {
  const mapped = colorMap[color] ?? colorMap['text-secondary']!;
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase border',
        mapped.bg,
        mapped.text,
        mapped.border,
        className
      )}
    >
      {children}
    </span>
  );
}
