import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'TaskStatusBadge.tsx'), 'utf-8');

describe('TaskStatusBadge deploy status support', () => {
  it('has deploying status in statusConfig', () => {
    expect(source).toContain("deploying: { color: 'purple', label: 'Deploying' }");
  });

  it('accepts deployStatus prop', () => {
    expect(source).toContain('deployStatus?: string | null');
  });

  it('renders DeployIcon when deployStatus is present', () => {
    expect(source).toContain('{deployStatus && <DeployIcon deployStatus={deployStatus} />}');
  });
});

describe('DeployIcon component', () => {
  it('renders CheckCircle for success', () => {
    expect(source).toContain("if (deployStatus === 'success') return <CheckCircle");
  });

  it('renders XCircle for failed', () => {
    expect(source).toContain("if (deployStatus === 'failed') return <XCircle");
  });

  it('renders spinning Loader for pending', () => {
    expect(source).toContain("if (deployStatus === 'pending') return <Loader");
    expect(source).toContain('animate-spin');
  });

  it('returns null for unknown deploy status', () => {
    expect(source).toContain('return null;');
  });
});
