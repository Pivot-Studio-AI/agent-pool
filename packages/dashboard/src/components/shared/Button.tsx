import { clsx } from 'clsx';

interface ButtonProps {
  variant?: 'primary' | 'success' | 'danger' | 'merge' | 'default';
  size?: 'sm' | 'md';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<string, string> = {
  primary: 'bg-accent text-white hover:bg-accent/80',
  success: 'bg-green text-white hover:bg-green/80',
  danger: 'border border-red text-red hover:bg-red/20',
  merge: 'bg-purple text-white hover:bg-purple/80',
  default: 'border border-border text-text-primary hover:bg-surface',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  children,
  className,
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {loading && (
        <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
