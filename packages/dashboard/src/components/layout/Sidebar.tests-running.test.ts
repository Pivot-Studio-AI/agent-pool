import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'Sidebar.tsx'), 'utf-8');

describe('Sidebar passes taskId to TaskStatusBadge', () => {
  it('passes task.id as taskId prop to TaskStatusBadge', () => {
    expect(source).toContain('taskId={task.id}');
  });

  it('still passes status prop', () => {
    expect(source).toContain('status={task.status}');
  });
});
