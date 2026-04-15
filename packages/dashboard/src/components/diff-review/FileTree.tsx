import { FileCode } from 'lucide-react';

interface FileInfo {
  path: string;
  additions: number;
  deletions: number;
}

interface FileTreeProps {
  files: FileInfo[];
  onFileClick: (path: string) => void;
}

export function FileTree({ files = [], onFileClick }: FileTreeProps) {
  return (
    <div className="space-y-0.5">
      <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Changed Files</h3>
      {files.map((file) => (
        <button
          key={file.path}
          onClick={() => onFileClick(file.path)}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-surface-hover/60 group"
        >
          <FileCode size={13} className="text-text-muted shrink-0 group-hover:text-accent" />
          <span className="text-xs text-text-secondary truncate flex-1 font-mono group-hover:text-text-primary">
            {file.path}
          </span>
          <span className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono">
            {file.additions > 0 && (
              <span className="text-green">+{file.additions}</span>
            )}
            {file.deletions > 0 && (
              <span className="text-red">-{file.deletions}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
