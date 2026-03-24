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
    background-color: #161b22;
    border-color: #21262d;
    color: #e6edf3;
  }
  .d2h-file-name {
    color: #e6edf3;
  }
  .d2h-file-wrapper {
    border-color: #21262d;
  }
  .d2h-diff-table {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
  }
  .d2h-code-line,
  .d2h-code-side-line {
    background-color: #0a0c10;
    color: #e6edf3;
  }
  .d2h-code-line-ctn {
    color: #e6edf3;
  }
  .d2h-del {
    background-color: rgba(248, 81, 73, 0.15);
    border-color: rgba(248, 81, 73, 0.4);
  }
  .d2h-del .d2h-code-line-ctn {
    color: #e6edf3;
  }
  .d2h-del del {
    background-color: rgba(248, 81, 73, 0.4);
    color: #e6edf3;
  }
  .d2h-ins {
    background-color: rgba(63, 185, 80, 0.15);
    border-color: rgba(63, 185, 80, 0.4);
  }
  .d2h-ins .d2h-code-line-ctn {
    color: #e6edf3;
  }
  .d2h-ins ins {
    background-color: rgba(63, 185, 80, 0.4);
    color: #e6edf3;
  }
  .d2h-info {
    background-color: rgba(88, 166, 255, 0.1);
    border-color: #21262d;
    color: #8b949e;
  }
  .d2h-code-linenumber {
    background-color: #161b22;
    border-color: #21262d;
    color: #484f58;
  }
  .d2h-emptyplaceholder,
  .d2h-code-side-emptyplaceholder {
    background-color: #161b22;
    border-color: #21262d;
  }
  .d2h-file-diff .d2h-del.d2h-change,
  .d2h-file-diff .d2h-ins.d2h-change {
    background-color: rgba(210, 153, 34, 0.15);
  }
  .d2h-tag {
    background-color: #161b22;
    border-color: #21262d;
    color: #8b949e;
  }
  .d2h-file-stats .d2h-lines-added {
    color: #3fb950;
  }
  .d2h-file-stats .d2h-lines-deleted {
    color: #f85149;
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
        className="overflow-auto rounded border border-border"
        dangerouslySetInnerHTML={{ __html: diffHtml }}
      />
    </div>
  );
}
