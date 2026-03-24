import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={clsx('bg-surface border border-border rounded-lg p-4', className)}>
      {children}
    </div>
  );
}
