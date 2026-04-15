import { describe, it, expect } from 'vitest';
import { extractPlan } from './plan-extractor';

describe('plan-extractor', () => {
  describe('extractPlan()', () => {
    it('returns null when no ## Plan header is present', () => {
      const text = 'Just some text without any plan headers.';
      expect(extractPlan(text)).toBeNull();
    });

    it('extracts a basic plan with all sections', () => {
      const text = `
## What I Found
The codebase uses Express with TypeScript.

## Plan
Add rate limiting middleware to all API routes.

## Files to Modify
- src/middleware/rateLimit.ts
- src/config/limits.ts

## NOT in Scope
- Database changes
- Frontend modifications

## Reasoning
Token bucket is the simplest approach for this use case.

## Estimate
2 files, ~60 lines
`;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.fileManifest).toEqual(['src/middleware/rateLimit.ts', 'src/config/limits.ts']);
      expect(result!.reasoning).toContain('Token bucket');
      expect(result!.estimate).toContain('2 files');
      expect(result!.whatFound).toContain('Express with TypeScript');
      expect(result!.notInScope).toContain('Database changes');
    });

    it('parses file manifest with backtick-wrapped paths', () => {
      const text = `
## Plan
Fix the bug.

## Files to Modify
- \`src/utils/helper.ts\` — update logic
- \`src/index.ts\`
`;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.fileManifest).toEqual(['src/utils/helper.ts', 'src/index.ts']);
    });

    it('handles case-insensitive headers', () => {
      const text = `
## PLAN
Do something.

## FILES TO MODIFY
- src/foo.ts

## REASONING
Because reasons.

## ESTIMATE
1 file
`;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.fileManifest).toEqual(['src/foo.ts']);
      expect(result!.reasoning).toContain('Because reasons');
    });

    it('handles bold headers (## **Plan**)', () => {
      const text = `
## **Plan**
My approach.

## **Files to Modify**
- src/a.ts
- src/b.ts
`;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.fileManifest).toHaveLength(2);
    });

    it('returns empty arrays/strings for missing optional sections', () => {
      const text = `
## Plan
Just a plan with no other sections.
`;
      const result = extractPlan(text);
      expect(result).not.toBeNull();
      expect(result!.fileManifest).toEqual([]);
      expect(result!.reasoning).toBe('');
      expect(result!.estimate).toBe('');
      expect(result!.whatFound).toBe('');
      expect(result!.notInScope).toBe('');
    });

    it('parses file manifest with * bullets', () => {
      const text = `
## Plan
Fix things.

## Files to Modify
* src/one.ts
* src/two.ts
`;
      const result = extractPlan(text);
      expect(result!.fileManifest).toEqual(['src/one.ts', 'src/two.ts']);
    });

    it('strips descriptions after em dash from file paths', () => {
      const text = `
## Plan
Fix things.

## Files to Modify
- src/api.ts — update endpoint
- src/db.ts — add migration
`;
      const result = extractPlan(text);
      expect(result!.fileManifest).toEqual(['src/api.ts', 'src/db.ts']);
    });
  });
});
