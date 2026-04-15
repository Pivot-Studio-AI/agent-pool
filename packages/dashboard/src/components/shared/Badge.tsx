import { clsx } from 'clsx';

interface BadgeProps {
  color: string;
  children: React.ReactNode;
  className?: string;
}

const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
  accent: { bg: 'bg-accent/10', text: 'text-accent', ring: 'ring-accent/20' },
  green: { bg: 'bg-green/10', text: 'text-green', ring: 'ring-green/20' },
  amber: { bg: 'bg-amber/10', text: 'text-amber', ring: 'ring-amber/20' },
  red: { bg: 'bg-red/10', text: 'text-red', ring: 'ring-red/20' },
  purple: { bg: 'bg-purple/10', text: 'text-purple', ring: 'ring-purple/20' },
  'text-muted': { bg: 'bg-text-muted/10', text: 'text-text-muted', ring: 'ring-text-muted/10' },
  'text-secondary': { bg: 'bg-text-muted/8', text: 'text-text-secondary', ring: 'ring-text-muted/10' },
};

export function Badge({ color, children, className }: BadgeProps) {
  const mapped = colorMap[color] ?? colorMap['text-secondary']!;
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase ring-1',
        mapped.bg,
        mapped.text,
        mapped.ring,
        className
      )}
    >
      {children}
    </span>
  );
}
