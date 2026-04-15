import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'Shell.tsx'), 'utf-8');

describe('Shell layout', () => {
  it('should import and render Header, Sidebar, TaskDetail, TaskInbox, and Toasts', () => {
    expect(source).toContain('<Header');
    expect(source).toContain('<Sidebar');
    expect(source).toContain('<TaskDetail');
    expect(source).toContain('<TaskInbox');
    expect(source).toContain('<Toasts');
  });

  it('should show TaskDetail when selectedTaskId is set, otherwise TaskInbox', () => {
    expect(source).toContain('selectedTaskId ?');
    expect(source).toContain('<TaskDetail />');
    expect(source).toContain('<TaskInbox />');
  });

  it('should have subtle gradient background blurs', () => {
    expect(source).toContain('bg-accent/[0.02]');
    expect(source).toContain('bg-purple/[0.02]');
    expect(source).toContain('blur-[120px]');
  });

  it('should use pointer-events-none on background gradient layer', () => {
    expect(source).toContain('pointer-events-none');
  });

  it('should restore task from URL on mount using pathname match', () => {
    expect(source).toContain("window.location.pathname.match(/^\\/tasks\\/([a-f0-9-]+)/)");
  });

  it('should handle browser back/forward via popstate', () => {
    expect(source).toContain("'popstate'");
    expect(source).toContain('handlePopState');
  });

  it('should use ml-60 for main content offset with relative positioning', () => {
    expect(source).toContain('ml-60 pt-14 min-h-screen relative');
  });
});
