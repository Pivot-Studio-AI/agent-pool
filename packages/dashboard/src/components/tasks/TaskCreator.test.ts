import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Smoke tests for TaskCreator paste/attachment fixes.
 *
 * Three bugs were fixed:
 * 1. Stale closure: paste handler now uses addAttachmentRef instead of
 *    closing over addAttachment directly.
 * 2. Mixed-content paste: preventDefault only called for image-only
 *    clipboard content, not when plain text is also present.
 * 3. Attachment previews moved from inline (header overflow) to the
 *    expanded panel dropdown.
 */

const source = readFileSync(
  resolve(__dirname, 'TaskCreator.tsx'),
  'utf-8'
);

describe('TaskCreator paste handler uses ref (stale closure fix)', () => {
  it('declares addAttachmentRef', () => {
    expect(source).toContain('addAttachmentRef');
  });

  it('paste handler calls addAttachmentRef.current, not addAttachment directly', () => {
    // Extract the paste handler body (between handlePaste definition and the cleanup)
    const pasteStart = source.indexOf('const handlePaste');
    const pasteEnd = source.indexOf("document.addEventListener('paste'");
    const pasteBody = source.slice(pasteStart, pasteEnd);

    // Should use the ref, not the function directly
    expect(pasteBody).toContain('addAttachmentRef.current');
    expect(pasteBody).not.toMatch(/\baddAttachment\b\(/);
  });

  it('keeps addAttachmentRef in sync outside useEffect', () => {
    // The sync line should be outside the useEffect, at module/component level
    const syncLine = 'addAttachmentRef.current = addAttachment';
    expect(source).toContain(syncLine);

    // Verify it comes BEFORE the useEffect paste handler
    const syncIdx = source.indexOf(syncLine);
    const useEffectIdx = source.indexOf("const handlePaste");
    expect(syncIdx).toBeLessThan(useEffectIdx);
  });
});

describe('TaskCreator mixed-content paste (preventDefault fix)', () => {
  it('tracks hasPlainText flag in paste handler', () => {
    expect(source).toContain('hasPlainText');
  });

  it('only calls preventDefault when there is no plain text', () => {
    // Should have the conditional: if (!hasPlainText) { e.preventDefault() }
    const pasteStart = source.indexOf('const handlePaste');
    const pasteEnd = source.indexOf("document.addEventListener('paste'");
    const pasteBody = source.slice(pasteStart, pasteEnd);

    expect(pasteBody).toContain('if (!hasPlainText)');
    expect(pasteBody).toContain('e.preventDefault()');
  });

  it('does not unconditionally call preventDefault inside the item loop', () => {
    // Old code had e.preventDefault() inside the for loop next to getAsFile.
    // New code collects files first, then conditionally prevents default.
    const forLoopStart = source.indexOf("for (let i = 0; i < items.length");
    const forLoopEnd = source.indexOf('if (imageFiles.length === 0)');
    const forLoopBody = source.slice(forLoopStart, forLoopEnd);

    expect(forLoopBody).not.toContain('preventDefault');
  });
});

describe('TaskCreator attachment previews in expanded panel', () => {
  it('renders attachment previews inside the expanded panel, not inline', () => {
    // The comment marking the new location
    expect(source).toContain('Attachments Preview');
  });

  it('does not render attachment thumbnails outside the expanded section', () => {
    // Old code had a flex-wrap gap-2 ml-6 container directly in the outer div.
    // New code only has previews inside {expanded && (...)}
    const expandedStart = source.indexOf('{expanded && (');
    const attachmentPreviewIdx = source.indexOf("Attachments ({attachments.length})");

    expect(expandedStart).toBeGreaterThan(-1);
    expect(attachmentPreviewIdx).toBeGreaterThan(-1);
    // Previews must be after the expanded gate
    expect(attachmentPreviewIdx).toBeGreaterThan(expandedStart);
  });

  it('shows a compact badge with count that opens expanded panel', () => {
    // The badge should use setExpanded(true) on click
    expect(source).toContain('onClick={() => setExpanded(true)}');
    // And display the attachment count
    expect(source).toContain('{attachments.length}');
  });

  it('non-image files are silently rejected (no alert)', () => {
    // The addAttachment function should just return for non-images, not alert
    const addAttStart = source.indexOf('const addAttachment = useCallback');
    const addAttEnd = source.indexOf('reader.readAsDataURL');
    const addAttBody = source.slice(addAttStart, addAttEnd);

    // Should check type and return silently
    expect(addAttBody).toContain("if (!file.type.startsWith('image/'))");
    // Should NOT have the old "Only image files" alert
    expect(addAttBody).not.toContain('Only image files are supported');
  });
});
