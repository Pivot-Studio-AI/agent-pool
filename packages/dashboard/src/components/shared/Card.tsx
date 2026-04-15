import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div className={clsx(
      'bg-surface rounded-xl p-5 shadow-card ring-1 ring-white/[0.03]',
      hover && 'hover:shadow-card-hover hover:ring-white/[0.06] hover:-translate-y-px',
      className
    )}>
      {children}
    </div>
  );
}
