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

export function FileManifest({ files, conflicts = [] }: FileManifestProps) {
  const conflictMap = new Map(
    conflicts.map((c) => [c.filePath, c])
  );

  return (
    <Card>
      <h3 className="text-sm font-bold text-text-primary mb-3">Files to Modify</h3>
      {files.length === 0 ? (
        <div className="text-text-muted text-sm">No files listed.</div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => {
            const conflict = conflictMap.get(file);
            return (
              <div
                key={file}
                className="flex items-center gap-2 py-1"
              >
                <FileCode size={14} className="text-text-muted shrink-0" />
                <span className="text-sm text-text-secondary truncate">
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
