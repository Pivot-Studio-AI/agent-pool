import { clsx } from 'clsx';

interface BadgeProps {
  color: string;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ color, children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
        `bg-${color}/20 text-${color}`,
        className
      )}
    >
      {children}
    </span>
  );
}
