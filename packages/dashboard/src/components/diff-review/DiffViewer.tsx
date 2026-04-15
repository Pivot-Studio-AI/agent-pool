import { useMemo } from 'react';
import * as Diff2Html from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';

interface DiffViewerProps {
  diffContent: string;
  viewMode: 'side-by-side' | 'line-by-line';
}

const darkThemeOverrides = `
  .d2h-wrapper {
    font-family: 'JetBrains Mono', monospace;
  }
  .d2h-file-header {
    background: linear-gradient(180deg, var(--color-surface-raised) 0%, var(--color-surface) 100%);
    border-color: var(--color-border);
    color: var(--color-text-primary);
    padding: 10px 14px;
  }
  .d2h-file-name {
    color: var(--color-text-primary);
    font-size: 12px;
  }
  .d2h-file-wrapper {
    border-color: var(--color-border);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 10px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
  .d2h-diff-table {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    line-height: 1.6;
  }
  .d2h-code-line,
  .d2h-code-side-line {
    background-color: var(--color-bg);
    color: var(--color-text-primary);
  }
  .d2h-code-line-ctn {
    color: var(--color-text-primary);
  }
  .d2h-del {
    background-color: rgba(248, 113, 113, 0.06);
    border-color: rgba(248, 113, 113, 0.15);
  }
  .d2h-del .d2h-code-line-ctn {
    color: var(--color-text-primary);
  }
  .d2h-del del {
    background-color: rgba(248, 113, 113, 0.25);
    color: var(--color-text-primary);
    border-radius: 2px;
  }
  .d2h-ins {
    background-color: rgba(52, 211, 153, 0.06);
    border-color: rgba(52, 211, 153, 0.15);
  }
  .d2h-ins .d2h-code-line-ctn {
    color: var(--color-text-primary);
  }
  .d2h-ins ins {
    background-color: rgba(52, 211, 153, 0.25);
    color: var(--color-text-primary);
    border-radius: 2px;
  }
  .d2h-info {
    background-color: rgba(108, 140, 255, 0.04);
    border-color: var(--color-border);
    color: var(--color-text-muted);
    font-size: 11px;
  }
  .d2h-code-linenumber {
    background-color: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text-muted);
    font-size: 11px;
  }
  .d2h-emptyplaceholder,
  .d2h-code-side-emptyplaceholder {
    background-color: var(--color-surface);
    border-color: var(--color-border);
  }
  .d2h-file-diff .d2h-del.d2h-change,
  .d2h-file-diff .d2h-ins.d2h-change {
    background-color: rgba(251, 191, 36, 0.06);
  }
  .d2h-tag {
    background-color: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text-muted);
  }
  .d2h-file-stats .d2h-lines-added {
    color: var(--color-green);
  }
  .d2h-file-stats .d2h-lines-deleted {
    color: var(--color-red);
  }
`;

export function DiffViewer({ diffContent, viewMode }: DiffViewerProps) {
  const diffHtml = useMemo(() => {
    if (!diffContent) return '';
    try {
      return Diff2Html.html(diffContent, {
        outputFormat: viewMode,
        drawFileList: false,
        matching: 'lines',
        diffStyle: 'word',
      });
    } catch {
      return '<div class="text-red text-sm p-4">Failed to render diff</div>';
    }
  }, [diffContent, viewMode]);

  return (
    <div className="diff-viewer-container">
      <style>{darkThemeOverrides}</style>
      <div
        className="overflow-auto rounded-xl shadow-card ring-1 ring-white/[0.03]"
        dangerouslySetInnerHTML={{ __html: diffHtml }}
      />
    </div>
  );
}
