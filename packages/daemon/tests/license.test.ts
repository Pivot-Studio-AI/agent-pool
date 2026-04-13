import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const licensePath = resolve(__dirname, '../../../LICENSE');
const license = readFileSync(licensePath, 'utf-8');

describe('LICENSE smoke tests', () => {
  it('exists and is non-empty', () => {
    expect(license.length).toBeGreaterThan(0);
  });

  it('is an MIT license', () => {
    expect(license).toMatch(/^MIT License/);
  });

  it('has the correct copyright holder', () => {
    expect(license).toMatch(/Copyright \(c\) 2026 Agent Pool/);
  });

  it('contains the standard MIT permission grant', () => {
    expect(license).toContain('Permission is hereby granted, free of charge');
    expect(license).toContain('without restriction');
  });

  it('contains the warranty disclaimer', () => {
    expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(license).toContain('WITHOUT WARRANTY OF ANY KIND');
  });
});
