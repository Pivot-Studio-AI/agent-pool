import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div className={clsx(
      'bg-surface rounded-xl p-5 shadow-card',
      hover && 'hover:shadow-card-hover hover:border-text-muted/20',
      className
    )}>
      {children}
    </div>
  );
}
