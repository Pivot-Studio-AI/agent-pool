import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div className={clsx(
      'bg-surface border border-border p-5',
      hover && 'hover:bg-surface-hover hover:border-text-muted/30',
      className
    )}>
      {children}
    </div>
  );
}
