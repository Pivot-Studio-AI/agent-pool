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
    <div className="space-y-1">
      <h3 className="text-sm font-bold text-text-primary mb-2">Changed Files</h3>
      {files.map((file) => (
        <button
          key={file.path}
          onClick={() => onFileClick(file.path)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-border/30 transition-colors group"
        >
          <span className="text-xs text-text-secondary truncate flex-1">
            {file.path}
          </span>
          <span className="flex items-center gap-1.5 shrink-0 text-xs">
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
