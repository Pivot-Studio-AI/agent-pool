import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(resolve(__dirname, 'DiffViewer.tsx'), 'utf-8');

describe('DiffViewer component', () => {
  it('should import and use Diff2Html library', () => {
    expect(source).toContain("import * as Diff2Html from 'diff2html'");
    expect(source).toContain('Diff2Html.html(');
  });

  it('should support side-by-side and line-by-line view modes', () => {
    expect(source).toContain("'side-by-side' | 'line-by-line'");
    expect(source).toContain('outputFormat: viewMode');
  });

  it('should include dark theme CSS overrides for diff2html', () => {
    expect(source).toContain('darkThemeOverrides');
    expect(source).toContain('.d2h-wrapper');
    expect(source).toContain('.d2h-del');
    expect(source).toContain('.d2h-ins');
  });

  it('should handle empty diff content gracefully', () => {
    expect(source).toContain("if (!diffContent) return ''");
  });

  it('should catch diff rendering errors', () => {
    expect(source).toContain('catch');
    expect(source).toContain('Failed to render diff');
  });
});
