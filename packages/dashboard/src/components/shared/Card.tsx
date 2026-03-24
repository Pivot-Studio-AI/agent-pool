import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={clsx('bg-surface border border-border rounded-xl p-5', className)}>
      {children}
    </div>
  );
}
