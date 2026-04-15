import { FileCode } from 'lucide-react';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';

interface FileConflict {
  filePath: string;
  taskId: string;
  taskTitle: string;
}

interface FileManifestProps {
  files: string[];
  conflicts?: FileConflict[];
}

export function FileManifest({ files = [], conflicts = [] }: FileManifestProps) {
  const conflictMap = new Map(
    conflicts.map((c) => [c.filePath, c])
  );

  return (
    <Card>
      <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Files to Modify</h3>
      {files.length === 0 ? (
        <div className="text-text-muted text-sm">No files listed.</div>
      ) : (
        <div className="space-y-1">
          {files.map((file) => {
            const conflict = conflictMap.get(file);
            return (
              <div
                key={file}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-hover/50 group"
              >
                <FileCode size={14} className="text-text-muted shrink-0 group-hover:text-accent" />
                <span className="text-sm text-text-secondary truncate font-mono text-xs">
                  {file}
                </span>
                {conflict && (
                  <Badge color="red">
                    Conflict: {conflict.taskTitle}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
