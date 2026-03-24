import { clsx } from 'clsx';

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
}

export function CodeBlock({ children, className }: CodeBlockProps) {
  return (
    <pre
      className={clsx(
        'bg-bg/50 border border-border rounded p-3 font-mono text-sm overflow-auto',
        className
      )}
    >
      {children}
    </pre>
  );
}
