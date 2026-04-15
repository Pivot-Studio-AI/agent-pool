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
  primary: 'bg-gradient-to-b from-accent to-accent/90 text-white hover:brightness-110 shadow-glow-accent ring-1 ring-accent/30',
  success: 'bg-gradient-to-b from-green to-green/90 text-white hover:brightness-110 shadow-glow-green ring-1 ring-green/30',
  danger: 'border border-red/30 text-red hover:bg-red/8 hover:border-red/50 ring-1 ring-transparent hover:ring-red/10',
  merge: 'bg-gradient-to-b from-purple to-purple/90 text-white hover:brightness-110 shadow-glow-purple ring-1 ring-purple/30',
  default: 'bg-surface-hover border border-border text-text-primary hover:border-text-muted/30 hover:bg-surface-raised shadow-inner-glow',
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
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
        'active:scale-[0.97]',
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
