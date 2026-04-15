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
  primary: 'bg-accent text-white hover:bg-accent/85 border border-accent/50',
  success: 'bg-green text-white hover:bg-green/85 border border-green/50',
  danger: 'border border-red/40 text-red hover:bg-red/8 hover:border-red/60',
  merge: 'bg-purple text-white hover:bg-purple/85 border border-purple/50',
  default: 'bg-surface-hover border border-border text-text-primary hover:border-text-muted/40 hover:bg-surface-raised',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
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
        'inline-flex items-center justify-center gap-1.5 font-medium',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'active:opacity-80',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {loading && (
        <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
