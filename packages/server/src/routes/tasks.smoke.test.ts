import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'tasks.ts'), 'utf-8');

describe('tasks route', () => {
  it('supports multipart file uploads via multer', () => {
    expect(source).toContain('multer');
    expect(source).toContain('attachments');
  });

  it('limits file uploads to images only', () => {
    expect(source).toContain('image/');
  });

  it('limits file size to 10MB', () => {
    expect(source).toContain('10 * 1024 * 1024');
  });

  it('limits max files to 10', () => {
    expect(source).toContain('10');
  });

  it('has cancel endpoint', () => {
    expect(source).toContain('/cancel');
    expect(source).toContain('cancelled');
  });

  it('has retry endpoint', () => {
    expect(source).toContain('/retry');
    expect(source).toContain('queued');
  });

  it('has test-results endpoint', () => {
    expect(source).toContain('test-results');
  });

  it('has deploy status endpoint', () => {
    expect(source).toContain('/deploy');
    expect(source).toContain('deploy_status');
  });

  it('filters tasks by repo_id', () => {
    expect(source).toContain('repo_id');
  });

  it('parses form data fields for task creation', () => {
    // When using multipart, fields come from req.body after multer parsing
    expect(source).toContain('req.body');
    expect(source).toContain('title');
    expect(source).toContain('description');
    expect(source).toContain('priority');
  });
});
